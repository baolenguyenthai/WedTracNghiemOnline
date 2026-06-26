import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler, ok } from "../lib/http.js";
import {
  bankCreateSchema,
  bankUpdateSchema,
  bankQuerySchema,
  questionCreateSchema,
  questionUpdateSchema
} from "../lib/validators.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { hashPassword, toSafeUser } from "../lib/auth.js";
import { exportQuestionsToDocx, exportQuestionsToXlsx } from "../lib/import-export.js";

export const adminRouter = Router();

function includeQuestionBank() {
  return {
    grade: true,
    subject: true,
    creator: {
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        vaiTroId: true,
        status: true
      }
    },
    _count: {
      select: {
        questions: true,
        exams: true
      }
    }
  } as const;
}

async function ensureUniqueQuestionAnswers(bankId: number, questionId: number | null, answers: Array<{ content: string; isCorrect: boolean }>) {
  const correctAnswers = answers.filter((answer) => answer.isCorrect);
  if (correctAnswers.length !== 1) {
    throw new AppError(400, "Mỗi câu hỏi phải có đúng 1 đáp án đúng.");
  }

  const question = questionId
    ? await prisma.question.update({
        where: { id: questionId },
        data: {
          bankId,
          content: "",
          difficulty: "TB"
        }
      })
    : await prisma.question.create({
        data: {
          bankId,
          content: "",
          difficulty: "TB"
        }
      });

  await prisma.answer.deleteMany({
    where: {
      questionId: question.id
    }
  });

  return question;
}

async function saveQuestionWithAnswers(params: {
  bankId: number;
  questionId?: number;
  content: string;
  difficulty: string;
  answers: Array<{ content: string; isCorrect: boolean }>;
}) {
  const { bankId, questionId, content, difficulty, answers } = params;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  if (correctCount !== 1) {
    throw new AppError(400, "Mỗi câu hỏi phải có đúng 1 đáp án đúng.");
  }

  return prisma.$transaction(async (tx) => {
    let question;
    if (questionId) {
      question = await tx.question.update({
        where: { id: questionId },
        data: {
          content,
          difficulty
        }
      });
      await tx.answer.deleteMany({ where: { questionId } });
    } else {
      question = await tx.question.create({
        data: {
          bankId,
          content,
          difficulty
        }
      });
    }

    for (const answer of answers) {
      await tx.answer.create({
        data: {
          questionId: question.id,
          content: answer.content,
          isCorrect: answer.isCorrect
        }
      });
    }

    return tx.question.findUnique({
      where: { id: question.id },
      include: {
        answers: {
          orderBy: { id: "asc" }
        }
      }
    });
  });
}

adminRouter.get(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const where: Prisma.UserWhereInput = {};
    
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        vaiTro: true
      }
    });

    users.sort((a, b) => {
      // 1. Sort by Role (Admin first)
      const roleA = a.vaiTro?.name === "ADMIN" ? 0 : 1;
      const roleB = b.vaiTro?.name === "ADMIN" ? 0 : 1;
      if (roleA !== roleB) return roleA - roleB;

      // 2. Sort by Last Name (Tên)
      const getLastName = (fullName: string | null) => {
        if (!fullName) return "";
        const parts = fullName.trim().split(/\s+/);
        return parts[parts.length - 1];
      };

      const nameA = getLastName(a.fullName);
      const nameB = getLastName(b.fullName);
      const cmp = nameA.localeCompare(nameB, "vi", { sensitivity: "base" });
      
      if (cmp !== 0) return cmp;

      // 3. Fallback to Full Name if Last Name is identical
      return (a.fullName || "").localeCompare(b.fullName || "", "vi", { sensitivity: "base" });
    });
    res.json(ok({ users: users.map(toSafeUser) }));
  })
);

adminRouter.post(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "").trim();
    const role = String(body.role || "USER").toUpperCase();
    const status = String(body.status || "ACTIVE").toUpperCase();

    if (!username || !email || !fullName || !password) {
      throw new AppError(400, "Vui lòng điền đầy đủ thông tin.");
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    });
    if (duplicate) {
      throw new AppError(409, "Tên đăng nhập hoặc email đã tồn tại.");
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        fullName,
        passwordHash: await hashPassword(password),
        vaiTroId: role === "ADMIN" ? 1 : 2,
        status: status === "LOCKED" ? 0 : 1
      },
      include: {
        vaiTro: true
      }
    });
    res.json(ok({ user: toSafeUser(user) }, "Tạo người dùng thành công."));
  })
);

adminRouter.put(
  "/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        vaiTro: true
      }
    });
    if (!user) {
      throw new AppError(404, "Không tìm thấy người dùng.");
    }

    if (user.vaiTro?.name === "ADMIN" && id !== req.user!.id) {
      throw new AppError(403, "Không thể chỉnh sửa thông tin của quản trị viên khác.");
    }

    const body = req.body as Record<string, unknown>;
    const fullName = String(body.fullName ?? user.fullName).trim();
    const email = String(body.email ?? user.email).trim();
    const role = String(body.role ?? user.vaiTro?.name ?? "USER").toUpperCase();
    const status = String(body.status ?? (user.status === 1 ? "ACTIVE" : "LOCKED")).toUpperCase();
    const password = body.password ? String(body.password) : null;

    const duplicate = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id }
      }
    });
    if (duplicate) {
      throw new AppError(409, "Email đã tồn tại.");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName,
        email,
        vaiTroId: role === "ADMIN" ? 1 : 2,
        status: status === "LOCKED" ? 0 : 1,
        ...(password ? { passwordHash: await hashPassword(password) } : {})
      },
      include: {
        vaiTro: true
      }
    });

    res.json(ok({ user: toSafeUser(updated) }, "Cập nhật người dùng thành công."));
  })
);

adminRouter.delete(
  "/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      throw new AppError(400, "Không thể tự xóa chính mình.");
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: { vaiTro: true }
    });
    if (!userToDelete) {
      throw new AppError(404, "Không tìm thấy người dùng.");
    }
    if (userToDelete.vaiTro?.name === "ADMIN") {
      throw new AppError(403, "Không thể xóa tài khoản quản trị viên.");
    }
    
    const examsCount = await prisma.exam.count({ where: { userId: id } });
    if (examsCount > 0) {
      throw new AppError(400, "Không thể xóa người dùng đã tham gia thi.");
    }

    await prisma.user.delete({ where: { id } });
    res.json(ok({}, "Đã xóa người dùng."));
  })
);

adminRouter.get(
  "/banks",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const filters = bankQuerySchema.parse(req.query);
    const where: Prisma.QuestionBankWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { subject: { name: { contains: filters.search } } }
      ];
    }
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.status) where.status = filters.status;
    if (typeof filters.isPublic === "boolean") where.isPublic = filters.isPublic;
    if (filters.mine) where.creatorId = req.user!.id;

    const banks = await prisma.questionBank.findMany({
      where,
      include: includeQuestionBank(),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    res.json(ok({ banks }));
  })
);

adminRouter.post(
  "/banks",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = bankCreateSchema.parse(req.body);
    const bank = await prisma.questionBank.create({
      data: {
        name: data.name,
        description: data.description || null,
        gradeId: data.gradeId,
        subjectId: data.subjectId,
        creatorId: req.user!.id,
        status: data.status || "CHO_DUYET",
        isPublic: data.isPublic,
        defaultQuestionCount: data.defaultQuestionCount ?? null,
        defaultDurationMinutes: data.defaultDurationMinutes ?? null
      }
    });
    res.json(ok({ bank }, "Tạo bộ câu hỏi thành công."));
  })
);

adminRouter.get(
  "/banks/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: includeQuestionBank()
    });
    if (!bank) {
      throw new AppError(404, "Không tìm thấy bộ câu hỏi.");
    }
    res.json(ok({ bank }));
  })
);

adminRouter.put(
  "/banks/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) {
      throw new AppError(404, "Không tìm thấy bộ câu hỏi.");
    }

    const data = bankUpdateSchema.parse(req.body);
    const updated = await prisma.questionBank.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.gradeId ? { gradeId: data.gradeId } : {}),
        ...(data.subjectId ? { subjectId: data.subjectId } : {}),
        ...(typeof data.isPublic === "boolean" ? { isPublic: data.isPublic } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.defaultQuestionCount !== undefined ? { defaultQuestionCount: data.defaultQuestionCount ?? null } : {}),
        ...(data.defaultDurationMinutes !== undefined ? { defaultDurationMinutes: data.defaultDurationMinutes ?? null } : {})
      }
    });

    res.json(ok({ bank: updated }, "Cập nhật bộ câu hỏi thành công."));
  })
);

adminRouter.patch(
  "/banks/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = String((req.body as Record<string, unknown>).status || "").toUpperCase();
    if (!["CHO_DUYET", "DA_DUYET", "TU_CHOI"].includes(status)) {
      throw new AppError(400, "Trạng thái không hợp lệ.");
    }
    const bank = await prisma.questionBank.update({
      where: { id },
      data: { status }
    });
    res.json(ok({ bank }, "Đã cập nhật trạng thái."));
  })
);

adminRouter.patch(
  "/banks/:id/visibility",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const isPublic = Boolean((req.body as Record<string, unknown>).isPublic);
    const bank = await prisma.questionBank.update({
      where: { id },
      data: { isPublic }
    });
    res.json(ok({ bank }, "Đã cập nhật chế độ công khai."));
  })
);

adminRouter.delete(
  "/banks/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const examCount = await prisma.exam.count({ where: { bankId: id } });
    if (examCount > 0) {
      throw new AppError(400, "Không thể xóa bộ đề vì đã có lượt thi. Vui lòng ẩn bộ đề thay vì xóa.");
    }
    await prisma.questionBank.delete({ where: { id } });
    res.json(ok({}, "Đã xóa bộ câu hỏi."));
  })
);

adminRouter.get(
  "/banks/:id/questions",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const questions = await prisma.question.findMany({
      where: { bankId: id },
      include: {
        answers: {
          orderBy: { id: "asc" }
        }
      },
      orderBy: { id: "asc" }
    });
    res.json(ok({ questions }));
  })
);

adminRouter.get(
  "/banks/:id/insights",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) {
      throw new AppError(404, "Không tìm thấy bộ câu hỏi.");
    }

    // Lấy tất cả chi tiết bài thi của bộ đề này
    const examItems = await prisma.examItem.findMany({
      where: { exam: { bankId: id } },
      include: {
        question: {
          include: { answers: { orderBy: { id: "asc" } } }
        }
      }
    });

    if (examItems.length === 0) {
      throw new AppError(400, "Chưa có đủ dữ liệu làm bài để phân tích.");
    }

    // Thống kê
    const stats: Record<number, {
      questionContent: string;
      totalAttempts: number;
      wrongAttempts: number;
      answers: string;
    }> = {};

    examItems.forEach((item) => {
      const qId = item.questionId;
      if (!stats[qId]) {
        stats[qId] = {
          questionContent: item.question.content,
          totalAttempts: 0,
          wrongAttempts: 0,
          answers: item.question.answers.map(a => `[${a.isCorrect ? 'ĐÚNG' : 'SAI'}] ${a.content}`).join(" | ")
        };
      }
      stats[qId].totalAttempts++;
      if (item.isCorrect === false) {
        stats[qId].wrongAttempts++;
      }
    });

    // Lọc ra top 5 câu sai nhiều nhất (ít nhất 1 lần sai)
    const sortedStats = Object.values(stats)
      .filter(s => s.wrongAttempts > 0)
      .sort((a, b) => b.wrongAttempts - a.wrongAttempts)
      .slice(0, 5);

    if (sortedStats.length === 0) {
      throw new AppError(400, "Không có câu hỏi nào bị trả lời sai để phân tích.");
    }

    const statsDataText = sortedStats.map((s, idx) => 
      `Câu ${idx + 1}:\nNội dung: ${s.questionContent}\nĐáp án: ${s.answers}\nSố lần trả lời sai: ${s.wrongAttempts}/${s.totalAttempts} (${Math.round(s.wrongAttempts/s.totalAttempts*100)}%)`
    ).join("\n\n");

    const { generateInsightReportWithGemini } = await import("../lib/ai.js");
    const reportMarkdown = await generateInsightReportWithGemini(statsDataText);

    res.json(ok({ report: reportMarkdown }));
  })
);

adminRouter.post(
  "/banks/:bankId/questions",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const bankId = Number(req.params.bankId);
    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      throw new AppError(404, "Không tìm thấy bộ câu hỏi.");
    }
    const data = questionCreateSchema.parse(req.body);
    const saved = await saveQuestionWithAnswers({
      bankId,
      content: data.content,
      difficulty: data.difficulty,
      answers: data.answers.map((answer) => ({
        content: answer.content,
        isCorrect: answer.isCorrect
      }))
    });
    res.json(ok({ question: saved }, "Đã thêm câu hỏi."));
  })
);

adminRouter.put(
  "/questions/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Không tìm thấy câu hỏi.");
    }
    if (existing.bankId == null) {
      throw new AppError(400, "Câu hỏi không thuộc bộ đề hợp lệ.");
    }
    const data = questionUpdateSchema.parse(req.body);
    const saved = await saveQuestionWithAnswers({
      bankId: existing.bankId,
      questionId: id,
      content: data.content,
      difficulty: data.difficulty,
      answers: data.answers.map((answer) => ({
        content: answer.content,
        isCorrect: answer.isCorrect
      }))
    });
    res.json(ok({ question: saved }, "Đã cập nhật câu hỏi."));
  })
);

adminRouter.delete(
  "/questions/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const examItemCount = await prisma.examItem.count({ where: { questionId: id } });
    if (examItemCount > 0) {
      throw new AppError(400, "Không thể xóa câu hỏi vì đã nằm trong lịch sử thi của người dùng.");
    }
    await prisma.question.delete({ where: { id } });
    res.json(ok({}, "Đã xóa câu hỏi."));
  })
);

adminRouter.get(
  "/banks/:id/export/docx",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
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

    const buffer = await exportQuestionsToDocx(
      bank.name,
      bank.questions.map((question) => ({
        content: question.content,
        difficulty: question.difficulty ?? "TB",
        answers: question.answers.map((answer) => ({
          content: answer.content,
          isCorrect: answer.isCorrect
        }))
      }))
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="export.docx"; filename*=UTF-8''${encodeURIComponent(bank.name)}.docx`);
    res.send(buffer);
  })
);

adminRouter.get(
  "/banks/:id/export/xlsx",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
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

    const buffer = await exportQuestionsToXlsx(
      bank.name,
      bank.questions.map((question) => ({
        content: question.content,
        difficulty: question.difficulty ?? "TB",
        answers: question.answers.map((answer) => ({
          content: answer.content,
          isCorrect: answer.isCorrect
        }))
      }))
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(bank.name)}.xlsx`);
    res.send(buffer);
  })
);

adminRouter.get(
  "/stats/overview",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const [totalUsers, activeUsers, totalBanks, pendingBanks, approvedBanks, totalExams] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 1 } }),
      prisma.questionBank.count(),
      prisma.questionBank.count({ where: { status: "CHO_DUYET" } }),
      prisma.questionBank.count({ where: { status: "DA_DUYET" } }),
      prisma.exam.count({ where: { submittedAt: { not: null } } })
    ]);

    const exams = await prisma.exam.findMany({
      where: { submittedAt: { not: null } },
      include: {
        user: true,
        bank: {
          include: {
            subject: true,
            grade: true
          }
        }
      },
      orderBy: [
        { submittedAt: "desc" },
        { id: "desc" }
      ]
    });

    const avgScore = exams.length
      ? Math.round((exams.reduce((sum, exam) => sum + (exam.score ?? 0), 0) / exams.length) * 100) / 100
      : 0;

    const byUser = new Map<number, { user: { id: number; fullName: string; username: string }; count: number; avgScore: number; totalScore: number }>();
    const bySubject = new Map<string, { subjectName: string; count: number; avgScore: number; totalScore: number }>();
    const byGrade = new Map<string, { gradeName: string; count: number; avgScore: number; totalScore: number }>();

    for (const exam of exams) {
      const userKey = exam.userId ?? 0;
      const userEntry = byUser.get(userKey) ?? {
        user: {
          id: exam.user?.id ?? 0,
          fullName: exam.user?.fullName ?? "",
          username: exam.user?.username ?? ""
        },
        count: 0,
        avgScore: 0,
        totalScore: 0
      };
      userEntry.count += 1;
      userEntry.totalScore += exam.score ?? 0;
      byUser.set(userKey, userEntry);

      const subjectKey = exam.bank?.subject?.name ?? "";
      const subjectEntry = bySubject.get(subjectKey) ?? {
        subjectName: subjectKey,
        count: 0,
        avgScore: 0,
        totalScore: 0
      };
      subjectEntry.count += 1;
      subjectEntry.totalScore += exam.score ?? 0;
      bySubject.set(subjectKey, subjectEntry);

      const gradeKey = exam.bank?.grade?.name ?? "";
      const gradeEntry = byGrade.get(gradeKey) ?? {
        gradeName: gradeKey,
        count: 0,
        avgScore: 0,
        totalScore: 0
      };
      gradeEntry.count += 1;
      gradeEntry.totalScore += exam.score ?? 0;
      byGrade.set(gradeKey, gradeEntry);
    }

    const topUsers = [...byUser.values()]
      .map((entry) => ({
        ...entry,
        avgScore: entry.count ? Math.round((entry.totalScore / entry.count) * 100) / 100 : 0
      }))
      .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
      .slice(0, 10);

    const topSubject = [...bySubject.values()]
      .map((entry) => ({
        ...entry,
        avgScore: entry.count ? Math.round((entry.totalScore / entry.count) * 100) / 100 : 0
      }))
      .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)[0] ?? null;

    const topGrade = [...byGrade.values()]
      .map((entry) => ({
        ...entry,
        avgScore: entry.count ? Math.round((entry.totalScore / entry.count) * 100) / 100 : 0
      }))
      .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)[0] ?? null;

    const recentExams = exams.slice(0, 8).map((exam) => ({
      examId: exam.id,
      userName: exam.user?.fullName ?? "",
      bankName: exam.bank?.name ?? "",
      subjectName: exam.bank?.subject?.name ?? "",
      gradeName: exam.bank?.grade?.name ?? "",
      score: exam.score ?? 0,
      correctCount: exam.correctCount ?? 0,
      totalQuestions: exam.totalQuestions ?? 0,
      submittedAt: exam.submittedAt,
      durationSeconds: exam.submittedAt && exam.startedAt
        ? Math.max(0, Math.round((exam.submittedAt.getTime() - exam.startedAt.getTime()) / 1000))
        : null
    }));

    res.json(
      ok({
        totalUsers,
        activeUsers,
        totalBanks,
        pendingBanks,
        approvedBanks,
        totalExams,
        avgScore,
        topUsers,
        topSubject,
        topGrade,
        recentExams
      })
    );
  })
);

adminRouter.get(
  "/stats/by-subject",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const subjects = await prisma.subject.findMany({
      include: {
        banks: {
          include: {
            exams: {
              where: { submittedAt: { not: null } }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const rows = subjects.map((subject) => {
      const exams = subject.banks.flatMap((bank) => bank.exams);
      const totalExams = exams.length;
      const avgScore = totalExams
        ? Math.round((exams.reduce((sum, exam) => sum + (exam.score ?? 0), 0) / totalExams) * 100) / 100
        : 0;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        totalBanks: subject.banks.length,
        totalExams,
        avgScore
      };
    });

    res.json(ok({ rows }));
  })
);

adminRouter.get(
  "/stats/by-grade",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const grades = await prisma.grade.findMany({
      include: {
        banks: {
          include: {
            exams: {
              where: { submittedAt: { not: null } }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const rows = grades.map((grade) => {
      const exams = grade.banks.flatMap((bank) => bank.exams);
      const totalExams = exams.length;
      const avgScore = totalExams
        ? Math.round((exams.reduce((sum, exam) => sum + (exam.score ?? 0), 0) / totalExams) * 100) / 100
        : 0;
      return {
        gradeId: grade.id,
        gradeName: grade.name,
        totalBanks: grade.banks.length,
        totalExams,
        avgScore
      };
    });

    res.json(ok({ rows }));
  })
);

// ═══════════════════════════════════════════════
// ADMIN EXAMS MANAGEMENT
// ═══════════════════════════════════════════════

// GET /exams - Danh sách bài thi
adminRouter.get(
  "/exams",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "");
    const bankId = req.query.bankId ? Number(req.query.bankId) : undefined;
    const status = req.query.status as string | undefined;

    const where: Prisma.ExamWhereInput = {
      ...(search ? {
        OR: [
          { user: { fullName: { contains: search } } },
          { user: { username: { contains: search } } },
          { bank: { name: { contains: search } } }
        ]
      } : {}),
      ...(bankId ? { bankId } : {}),
      ...(status === "submitted" ? { submittedAt: { not: null } } : {}),
      ...(status === "ongoing" ? { submittedAt: null } : {})
    };

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, username: true } },
          bank: { select: { id: true, name: true, subject: { select: { name: true } } } }
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.exam.count({ where })
    ]);

    res.json(ok({
      exams: exams.map((e) => {
        const dur = e.startedAt && e.submittedAt
          ? Math.round((e.submittedAt.getTime() - e.startedAt.getTime()) / 1000)
          : null;
        return {
          id: e.id,
          userId: e.userId,
          userName: e.user?.fullName ?? "",
          username: e.user?.username ?? "",
          bankId: e.bankId,
          bankName: e.bank?.name ?? "",
          subjectName: e.bank?.subject?.name ?? "",
          score: e.score,
          totalQuestions: e.totalQuestions,
          correctCount: e.correctCount,
          submittedAt: e.submittedAt,
          createdAt: e.startedAt,
          durationSeconds: dur
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }));
  })
);

// DELETE /exams/:id - Xóa bài thi
adminRouter.delete(
  "/exams/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new AppError(404, "Không tìm thấy bài thi.");
    await prisma.examItem.deleteMany({ where: { examId: id } });
    await prisma.exam.delete({ where: { id } });
    res.json(ok({ deleted: true }));
  })
);

// GET /exams/:id - Chi tiết bài thi (câu hỏi + đáp án)
adminRouter.get(
  "/exams/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        bank: { select: { id: true, name: true } },
        items: {
          include: {
            question: {
              include: {
                answers: { select: { id: true, content: true, isCorrect: true } }
              }
            }
          }
        }
      }
    });

    if (!exam) throw new AppError(404, "Không tìm thấy bài thi.");

    // Lấy thông tin đáp án đã chọn theo selectedAnswerId
    const selectedAnswerIds = exam.items
      .map(i => i.selectedAnswerId)
      .filter((id): id is number => id !== null);

    const selectedAnswers = selectedAnswerIds.length > 0
      ? await prisma.answer.findMany({
          where: { id: { in: selectedAnswerIds } },
          select: { id: true, content: true, isCorrect: true }
        })
      : [];
    const answerMap = new Map(selectedAnswers.map(a => [a.id, a]));

    const dur = exam.startedAt && exam.submittedAt
      ? Math.round((exam.submittedAt.getTime() - exam.startedAt.getTime()) / 1000)
      : null;

    res.json(ok({
      exam: {
        id: exam.id,
        userId: exam.userId,
        userName: exam.user?.fullName ?? "",
        username: exam.user?.username ?? "",
        bankId: exam.bankId,
        bankName: exam.bank?.name ?? "",
        score: exam.score,
        totalQuestions: exam.totalQuestions,
        correctCount: exam.correctCount,
        submittedAt: exam.submittedAt,
        createdAt: exam.startedAt,
        durationSeconds: dur,
        items: exam.items.map((item, idx) => {
          const sel = item.selectedAnswerId ? answerMap.get(item.selectedAnswerId) : null;
          return {
            index: idx + 1,
            questionId: item.questionId,
            questionContent: item.question.content,
            answers: item.question.answers,
            selectedAnswerId: item.selectedAnswerId,
            selectedAnswerContent: sel?.content ?? null,
            correctAnswerContent: item.question.answers.find((a: { isCorrect: boolean; content: string }) => a.isCorrect)?.content ?? null,
            isCorrect: item.isCorrect
          };
        })
      }
    }));
  })
);

// GET /users/:userId/exams - Lịch sử thi theo user
adminRouter.get(
  "/users/:userId/exams",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where: { userId },
        include: {
          bank: { select: { id: true, name: true } }
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.exam.count({ where: { userId } })
    ]);

    res.json(ok({
      exams: exams.map(e => {
        const dur = e.startedAt && e.submittedAt
          ? Math.round((e.submittedAt.getTime() - e.startedAt.getTime()) / 1000)
          : null;
        return {
          id: e.id,
          bankId: e.bankId,
          bankName: e.bank?.name ?? "",
          score: e.score,
          totalQuestions: e.totalQuestions,
          correctCount: e.correctCount,
          submittedAt: e.submittedAt,
          createdAt: e.startedAt,
          durationSeconds: dur
        };
      }),
      total,
      totalPages: Math.ceil(total / limit)
    }));
  })
);


