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
    grades.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    res.json(ok({ grades }));
  })
);

metaRouter.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
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
    await prisma.subject.delete({ where: { id } });
    res.json(ok({}, "Đã xóa môn học."));
  })
);
