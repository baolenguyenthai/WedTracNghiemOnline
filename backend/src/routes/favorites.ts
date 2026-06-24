import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../lib/http.js";
import { favoriteQuerySchema } from "../lib/validators.js";
import { requireAuth } from "../middleware/auth.js";

export const favoritesRouter = Router();

favoritesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filters = favoriteQuerySchema.parse(req.query);
    const favorites = await prisma.favoriteQuestion.findMany({
      where: {
        userId: req.user!.id,
        ...(filters.gradeId || filters.subjectId
          ? {
              question: {
                bank: {
                  ...(filters.gradeId ? { gradeId: filters.gradeId } : {}),
                  ...(filters.subjectId ? { subjectId: filters.subjectId } : {})
                }
              }
            }
          : {})
      },
      include: {
        question: {
          include: {
            bank: {
              include: {
                grade: true,
                subject: true
              }
            },
            answers: {
              orderBy: { id: "asc" }
            }
          }
        }
      },
      orderBy: {
        questionId: "desc"
      }
    });

    res.json(
      ok({
        favorites: favorites.map((favorite) => {
          const bank = favorite.question.bank;
          const correctAnswer = favorite.question.answers.find((answer) => answer.isCorrect);
          return {
            questionId: favorite.questionId,
            question: favorite.question.content,
            difficulty: favorite.question.difficulty ?? "TB",
            bankName: bank?.name ?? "",
            gradeName: bank?.grade?.name ?? "",
            subjectName: bank?.subject?.name ?? "",
            isPublic: bank?.isPublic ?? false,
            correctAnswer: correctAnswer?.content ?? ""
          };
        })
      })
    );
  })
);

favoritesRouter.post(
  "/:questionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        bank: true
      }
    });

    if (!question) {
      throw new AppError(404, "Không tìm thấy câu hỏi.");
    }
    if (!question.bank) {
      throw new AppError(404, "Câu hỏi không còn thuộc bộ đề.");
    }

    const favoriteKey = {
      userId_questionId: {
        userId: req.user!.id,
        questionId
      }
    } as const;

    const existing = await prisma.favoriteQuestion.findUnique({
      where: favoriteKey
    });

    if (existing) {
      await prisma.favoriteQuestion.delete({ where: favoriteKey });
      res.json(ok({ favorited: false }, "Đã bỏ yêu thích."));
      return;
    }

    const canFavorite = question.bank.isPublic || req.user!.role === "ADMIN" || question.bank.creatorId === req.user!.id;
    if (!canFavorite) {
      throw new AppError(403, "Chỉ có thể yêu thích câu hỏi thuộc bộ công khai.");
    }

    await prisma.favoriteQuestion.create({
      data: {
        userId: req.user!.id,
        questionId
      }
    });

    res.json(ok({ favorited: true }, "Đã thêm vào yêu thích."));
  })
);

favoritesRouter.delete(
  "/:questionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    await prisma.favoriteQuestion.deleteMany({
      where: {
        userId: req.user!.id,
        questionId
      }
    });
    res.json(ok({ favorited: false }, "Đã bỏ yêu thích."));
  })
);
