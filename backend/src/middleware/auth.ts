import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/http.js";
import { toSafeUser, verifyToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        fullName: string;
        email: string;
        role: string;
        status: string;
      };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "Bạn cần đăng nhập."));
  }

  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        vaiTro: true
      }
    });
    if (!user || user.status !== 1) {
      return next(new AppError(401, "Tài khoản không hợp lệ."));
    }

    req.user = toSafeUser(user);
    next();
  } catch {
    next(new AppError(401, "Token không hợp lệ."));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Bạn cần đăng nhập."));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Bạn không có quyền thực hiện thao tác này."));
    }

    next();
  };
}
