import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, ok } from "../lib/http.js";
import { gradeSchema, subjectSchema } from "../lib/validators.js";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const metaRouter = Router();

metaRouter.get(
  "/grades",
  asyncHandler(async (_req, res) => {
    const grades = await prisma.grade.findMany();
    
    const gradeOrder: Record<string, number> = {
      "Đại học": 1,
      "THPT": 2,
      "THCS": 3,
      "Tiểu học": 4
    };

    grades.sort((a, b) => {
      const orderA = gradeOrder[a.name] || 99;
      const orderB = gradeOrder[b.name] || 99;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      return a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" });
    });

    res.json(ok({ grades }));
  })
);

metaRouter.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const subjects = await prisma.subject.findMany();
    subjects.sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
    res.json(ok({ subjects }));
  })
);

metaRouter.post(
  "/admin/grades",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = gradeSchema.parse(req.body);
    const existing = await prisma.grade.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(409, "Cấp học đã tồn tại.");
    const grade = await prisma.grade.create({ data });
    res.json(ok({ grade }, "Tạo cấp học thành công."));
  })
);

metaRouter.put(
  "/admin/grades/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = gradeSchema.parse(req.body);
    const id = Number(req.params.id);
    const grade = await prisma.grade.findUnique({ where: { id } });
    if (!grade) throw new AppError(404, "Không tìm thấy cấp học.");
    const duplicate = await prisma.grade.findUnique({ where: { name: data.name } });
    if (duplicate && duplicate.id !== id) throw new AppError(409, "Tên cấp học đã tồn tại.");
    const updated = await prisma.grade.update({ where: { id }, data });
    res.json(ok({ grade: updated }, "Cập nhật cấp học thành công."));
  })
);

metaRouter.delete(
  "/admin/grades/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const count = await prisma.questionBank.count({ where: { gradeId: id } });
    if (count > 0) {
      throw new AppError(400, "Không thể xóa cấp học vì đang có bộ đề thuộc cấp học này.");
    }
    await prisma.grade.delete({ where: { id } });
    res.json(ok({}, "Đã xóa cấp học."));
  })
);

metaRouter.post(
  "/admin/subjects",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = subjectSchema.parse(req.body);
    const existing = await prisma.subject.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(409, "Môn học đã tồn tại.");
    const subject = await prisma.subject.create({ data });
    res.json(ok({ subject }, "Tạo môn học thành công."));
  })
);

metaRouter.put(
  "/admin/subjects/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = subjectSchema.parse(req.body);
    const id = Number(req.params.id);
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new AppError(404, "Không tìm thấy môn học.");
    const duplicate = await prisma.subject.findUnique({ where: { name: data.name } });
    if (duplicate && duplicate.id !== id) throw new AppError(409, "Tên môn học đã tồn tại.");
    const updated = await prisma.subject.update({ where: { id }, data });
    res.json(ok({ subject: updated }, "Cập nhật môn học thành công."));
  })
);

metaRouter.delete(
  "/admin/subjects/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    // Kiểm tra xem môn học có thuộc bộ đề nào có câu hỏi (và đáp án) không
    const banksWithQuestionsCount = await prisma.questionBank.count({
      where: {
        subjectId: id,
        questions: {
          some: {}, // Có ít nhất 1 câu hỏi
        },
      },
    });

    if (banksWithQuestionsCount > 0) {
      throw new AppError(
        400,
        "Không thể xóa môn học vì đang có bộ đề chứa câu hỏi và đáp án. Chỉ được xóa khi xóa ở mục bộ đề (và bộ đề đó chưa có ai thi)."
      );
    }

    const examCount = await prisma.exam.count({
      where: {
        bank: {
          subjectId: id,
        },
      },
    });

    if (examCount > 0) {
      throw new AppError(400, "Không thể xóa môn học vì đã có người thi các bộ đề thuộc môn học này.");
    }

    await prisma.$transaction(async (tx) => {
      // Xóa tất cả bộ đề thuộc môn học này (những bộ đề trống). 
      await tx.questionBank.deleteMany({ where: { subjectId: id } });
      // Xóa môn học
      await tx.subject.delete({ where: { id } });
    });
    res.json(ok({}, "Đã xóa môn học."));
  })
);
