import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http.js";
import { ZodError } from "zod";

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Không tìm thấy tài nguyên."));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const errorMessages = err.issues.map((e) => e.message).join(", ");
    res.status(400).json({
      success: false,
      message: errorMessages || "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại."
    });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : "Lỗi hệ thống.";
  res.status(statusCode).json({
    success: false,
    message
  });
}
