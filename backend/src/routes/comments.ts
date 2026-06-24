import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, AppError, ok } from "../lib/http.js";
import { z } from "zod";

export const commentsRouter = Router();

const createCommentSchema = z.object({
  content: z.string().min(1, "Nội dung bình luận không được để trống").max(2000)
});

// Lấy danh sách bình luận của 1 câu hỏi
commentsRouter.get(
  "/questions/:questionId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    
    const comments = await prisma.comment.findMany({
      where: { questionId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            vaiTro: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(ok({ comments }));
  })
);

// Thêm bình luận
commentsRouter.post(
  "/questions/:questionId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { content } = createCommentSchema.parse(req.body);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new AppError(404, "Không tìm thấy câu hỏi.");
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        questionId,
        userId: req.user!.id
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            vaiTro: { select: { name: true } }
          }
        }
      }
    });

    res.json(ok({ comment }));
  })
);
