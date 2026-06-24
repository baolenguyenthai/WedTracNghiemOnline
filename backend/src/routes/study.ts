import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../lib/http.js";

export const studyRouter = Router();

// Lấy những câu hỏi hay làm sai nhất của user
studyRouter.get(
  "/weak-questions",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Lấy tất cả các chi tiết bài thi mà user đã làm sai
    const wrongItems = await prisma.examItem.findMany({
      where: {
        isCorrect: false,
        exam: {
          userId: req.user!.id,
          submittedAt: { not: null }
        }
      },
      include: {
        question: {
          include: {
            answers: true,
            bank: {
              select: { name: true, subject: true }
            }
          }
        }
      }
    });

    // Gom nhóm và đếm số lần sai
    const questionStats = new Map<number, { question: any; failCount: number }>();

    for (const item of wrongItems) {
      if (questionStats.has(item.questionId)) {
        questionStats.get(item.questionId)!.failCount += 1;
      } else {
        questionStats.set(item.questionId, {
          question: item.question,
          failCount: 1
        });
      }
    }

    // Lọc ra các câu sai nhiều và sort
    const weakQuestions = Array.from(questionStats.values())
      .sort((a, b) => b.failCount - a.failCount)
      .slice(0, 50); // Tối đa 50 flashcard một lần học

    res.json(ok({ weakQuestions }));
  })
);
