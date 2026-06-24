import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler, ok } from "../lib/http.js";
import { examStartSchema, examSubmitSchema, leaderboardQuerySchema } from "../lib/validators.js";
import { requireAuth } from "../middleware/auth.js";
import { pickRandom, shuffle, toExamScore } from "../lib/utils.js";
import { evaluateBadges } from "./gamification.js";

export const examsRouter = Router();

function computeDurationSeconds(startedAt?: Date | null, submittedAt?: Date | null) {
  if (!startedAt || !submittedAt) {
    return null;
  }
  return Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000));
}

examsRouter.post(
  "/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = examStartSchema.parse(req.body);
    const bank = await prisma.questionBank.findUnique({
      where: { id: data.bankId },
      include: {
        grade: true,
        subject: true,
        questions: {
          include: {
            answers: {
              orderBy: { id: "asc" }
            }
          },
          orderBy: { id: "asc" }
        }
      }
    });

    if (!bank) {
      throw new AppError(404, "Không tìm thấy bộ câu hỏi.");
    }

    const canAccess = bank.status === "DA_DUYET" || req.user!.role === "ADMIN" || bank.creatorId === req.user!.id;
    if (!canAccess) {
      throw new AppError(403, "Bộ câu hỏi chưa được duyệt.");
    }

    if (!bank.questions.length) {
      throw new AppError(400, "Bộ câu hỏi chưa có câu hỏi nào.");
    }

    const defaultCount = bank.isPublic
      ? data.questionCount ?? bank.defaultQuestionCount ?? bank.questions.length
      : bank.defaultQuestionCount ?? bank.questions.length;
    const defaultDuration = bank.isPublic
      ? data.durationMinutes ?? bank.defaultDurationMinutes ?? 20
      : bank.defaultDurationMinutes ?? 20;

    const questionCount = Math.max(1, Math.min(defaultCount, bank.questions.length));
    const durationMinutes = Math.max(1, Math.min(defaultDuration, 600));
    const selectedQuestions = pickRandom(bank.questions, questionCount);

    const exam = await prisma.$transaction(async (tx) => {
      const createdExam = await tx.exam.create({
        data: {
          userId: req.user!.id,
          bankId: bank.id,
          totalQuestions: questionCount,
          startedAt: new Date()
        }
      });

      await tx.examItem.createMany({
        data: selectedQuestions.map((question) => ({
          examId: createdExam.id,
          questionId: question.id,
          selectedAnswerId: null,
          isCorrect: null
        }))
      });

      return createdExam;
    });

    res.json(
      ok(
        {
          exam: {
            id: exam.id,
            bankId: exam.bankId,
            totalQuestions: exam.totalQuestions ?? questionCount,
            startedAt: exam.startedAt,
            durationSeconds: durationMinutes * 60,
            publicAtStart: bank.isPublic
          },
          bank: {
            id: bank.id,
            name: bank.name,
            description: bank.description,
            isPublic: bank.isPublic,
            grade: bank.grade,
            subject: bank.subject
          },
          questions: selectedQuestions.map((question) => ({
            id: question.id,
            content: question.content,
            difficulty: question.difficulty,
            answers: shuffle(
              question.answers.map((answer) => ({
                id: answer.id,
                content: answer.content,
                isCorrect: data.isReviewMode ? answer.isCorrect : undefined
              }))
            )
          }))
        },
        "Bắt đầu bài thi thành công."
      )
    );
  })
);

examsRouter.post(
  "/:id/submit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = examSubmitSchema.parse(req.body);
    const examId = Number(req.params.id);
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        bank: {
          include: {
            grade: true,
            subject: true
          }
        },
        items: {
          include: {
            question: {
              include: {
                answers: {
                  orderBy: { id: "asc" }
                }
              }
            }
          },
          orderBy: { questionId: "asc" }
        }
      }
    });

    if (!exam) {
      throw new AppError(404, "Không tìm thấy bài thi.");
    }

    if (exam.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new AppError(403, "Bạn không có quyền xem bài thi này.");
    }

    if (exam.submittedAt) {
      throw new AppError(409, "Bài thi đã được nộp trước đó.");
    }

    const answerMap = new Map<number, number | null>();
    data.answers.forEach((answer) => {
      answerMap.set(answer.questionId, answer.answerId ?? null);
    });

    const savedExam = await prisma.$transaction(async (tx) => {
      let correctCount = 0;

      for (const item of exam.items) {
        const selectedAnswerId = answerMap.get(item.questionId) ?? null;
        const selectedAnswer = selectedAnswerId
          ? item.question.answers.find((answer) => answer.id === selectedAnswerId) ?? null
          : null;
        const isCorrect = Boolean(selectedAnswer?.isCorrect);
        if (isCorrect) {
          correctCount += 1;
        }

        await tx.examItem.update({
          where: {
            examId_questionId: {
              examId: exam.id,
              questionId: item.questionId
            }
          },
          data: {
            selectedAnswerId,
            isCorrect
          }
        });
      }

      const submittedAt = new Date();
      const score = toExamScore(correctCount, exam.totalQuestions ?? exam.items.length);

      return tx.exam.update({
        where: { id: exam.id },
        data: {
          correctCount,
          score,
          submittedAt
        }
      });
    });

    const durationSeconds = computeDurationSeconds(exam.startedAt, savedExam.submittedAt);

    // Xử lý gamification ngầm sau khi nộp bài
    await evaluateBadges(req.user!.id).catch(console.error);

    res.json(
      ok(
        {
          exam: {
            id: savedExam.id,
            totalQuestions: savedExam.totalQuestions ?? exam.items.length,
            correctCount: savedExam.correctCount ?? 0,
            score: savedExam.score ?? 0,
            submittedAt: savedExam.submittedAt,
            durationSeconds
          },
          items: exam.items.map((item) => {
            const selectedAnswerId = answerMap.get(item.questionId) ?? null;
            const selectedAnswer = selectedAnswerId
              ? item.question.answers.find((answer) => answer.id === selectedAnswerId) ?? null
              : null;
            const correctAnswer = item.question.answers.find((answer) => answer.isCorrect) ?? null;
            const isCorrect = Boolean(selectedAnswer?.isCorrect);

            return {
              id: item.questionId,
              questionId: item.questionId,
              questionContent: item.question.content,
              selectedAnswerId,
              selectedAnswerContent: selectedAnswer?.content ?? null,
              correctAnswerContent: correctAnswer?.content ?? null,
              isCorrect
            };
          })
        },
        "Nộp bài thành công."
      )
    );
  })
);

examsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const exams = await prisma.exam.findMany({
      where: { userId: req.user!.id },
      include: {
        bank: {
          include: {
            grade: true,
            subject: true
          }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: [
        { submittedAt: "desc" },
        { id: "desc" }
      ]
    });

    res.json(
      ok({
        exams: exams.map((exam) => ({
          id: exam.id,
          bankId: exam.bankId,
          bankName: exam.bank?.name ?? "",
          gradeName: exam.bank?.grade?.name ?? "",
          subjectName: exam.bank?.subject?.name ?? "",
          totalQuestions: exam.totalQuestions ?? 0,
          correctCount: exam.correctCount ?? 0,
          score: exam.score ?? 0,
          startedAt: exam.startedAt,
          submittedAt: exam.submittedAt,
          durationSeconds: computeDurationSeconds(exam.startedAt, exam.submittedAt),
          publicAtStart: Boolean(exam.bank?.isPublic),
          questionCount: exam._count.items
        }))
      })
    );
  })
);

examsRouter.get(
  "/leaderboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filters = leaderboardQuerySchema.parse(req.query);
    const where: Prisma.ExamWhereInput = {
      submittedAt: { not: null }
    };

    if (filters.gradeId || filters.subjectId) {
      where.bank = {
        ...(filters.gradeId ? { gradeId: filters.gradeId } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {})
      };
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        user: {
          include: {
            vaiTro: true
          }
        },
        bank: {
          include: {
            grade: true,
            subject: true
          }
        }
      }
    });

    const rows = exams
      .sort((a, b) => {
        const aScore = a.score ?? 0;
        const bScore = b.score ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        const aTime = computeDurationSeconds(a.startedAt, a.submittedAt) ?? Number.MAX_SAFE_INTEGER;
        const bTime = computeDurationSeconds(b.startedAt, b.submittedAt) ?? Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
      })
      .slice(0, 50)
      .map((exam, index) => ({
        rank: index + 1,
        examId: exam.id,
        userId: exam.userId ?? 0,
        userName: exam.user?.fullName ?? "",
        username: exam.user?.username ?? "",
        bankName: exam.bank?.name ?? "",
        gradeName: exam.bank?.grade?.name ?? "",
        subjectName: exam.bank?.subject?.name ?? "",
        score: exam.score ?? 0,
        correctCount: exam.correctCount ?? 0,
        totalQuestions: exam.totalQuestions ?? 0,
        durationSeconds: computeDurationSeconds(exam.startedAt, exam.submittedAt),
        submittedAt: exam.submittedAt
      }));

    res.json(ok({ leaderboard: rows }));
  })
);

examsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const examId = Number(req.params.id);
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        user: {
          include: {
            vaiTro: true
          }
        },
        bank: {
          include: {
            grade: true,
            subject: true
          }
        },
        items: {
          include: {
            question: {
              include: {
                answers: {
                  orderBy: { id: "asc" }
                }
              }
            }
          },
          orderBy: { questionId: "asc" }
        }
      }
    });

    if (!exam) {
      throw new AppError(404, "Không tìm thấy bài thi.");
    }

    if (exam.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new AppError(403, "Bạn không có quyền xem bài thi này.");
    }

    res.json(
      ok({
        exam: {
          id: exam.id,
          bankId: exam.bankId,
          bankName: exam.bank?.name ?? "",
          gradeName: exam.bank?.grade?.name ?? "",
          subjectName: exam.bank?.subject?.name ?? "",
          totalQuestions: exam.totalQuestions ?? 0,
          correctCount: exam.correctCount ?? 0,
          score: exam.score ?? 0,
          startedAt: exam.startedAt,
          submittedAt: exam.submittedAt,
          durationSeconds: computeDurationSeconds(exam.startedAt, exam.submittedAt),
          publicAtStart: Boolean(exam.bank?.isPublic),
          user: {
            id: exam.user?.id ?? 0,
            fullName: exam.user?.fullName ?? "",
            username: exam.user?.username ?? ""
          },
          items: exam.items.map((item) => {
            const selectedAnswer = item.selectedAnswerId
              ? item.question.answers.find((answer) => answer.id === item.selectedAnswerId) ?? null
              : null;
            const correctAnswer = item.question.answers.find((answer) => answer.isCorrect) ?? null;

            return {
              id: item.questionId,
              questionId: item.questionId,
              questionContent: item.question.content,
              selectedAnswerId: item.selectedAnswerId,
              selectedAnswerContent: selectedAnswer?.content ?? null,
              correctAnswerContent: correctAnswer?.content ?? null,
              isCorrect: item.isCorrect ?? false,
              question: {
                content: item.question.content,
                difficulty: item.question.difficulty ?? "TB",
                answers: item.question.answers.map((answer) => ({
                  id: answer.id,
                  content: answer.content,
                  isCorrect: answer.isCorrect
                }))
              }
            };
          })
        }
      })
    );
  })
);
