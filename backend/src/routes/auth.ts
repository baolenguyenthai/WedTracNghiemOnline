import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler, ok } from "../lib/http.js";
import { comparePassword, hashPassword, signToken, toSafeUser } from "../lib/auth.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema } from "../lib/validators.js";
import { requireAuth } from "../middleware/auth.js";
import { sendOtpEmail } from "../lib/email.js";
import { clearPasswordResetToken, setPasswordResetToken, verifyPasswordResetToken } from "../lib/password-reset.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }]
      }
    });
    if (existing) {
      throw new AppError(409, "Tên đăng nhập hoặc email đã tồn tại.");
    }

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: await hashPassword(data.password),
        fullName: data.fullName,
        email: data.email,
        vaiTroId: 2,
        status: 1
      },
      include: {
        vaiTro: true
      }
    });

    const safeUser = toSafeUser(user);
    res.json(
      ok(
        {
          token: signToken(safeUser),
          user: safeUser
        },
        "Đăng ký thành công."
      )
    );
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: data.usernameOrEmail }, { email: data.usernameOrEmail }]
      },
      include: {
        vaiTro: true
      }
    });

    if (!user) {
      throw new AppError(401, "Sai tên đăng nhập hoặc mật khẩu.");
    }
    if (user.status !== 1) {
      throw new AppError(403, "Tài khoản đã bị khóa.");
    }

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Sai tên đăng nhập hoặc mật khẩu.");
    }

    const safeUser = toSafeUser(user);
    res.json(
      ok(
        {
          token: signToken(safeUser),
          user: safeUser
        },
        "Đăng nhập thành công."
      )
    );
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        vaiTro: true
      }
    });
    if (!user) {
      throw new AppError(404, "Không tìm thấy người dùng.");
    }
    res.json(ok({ user: toSafeUser(user) }));
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const duplicate = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: req.user!.id }
      }
    });
    if (duplicate) {
      throw new AppError(409, "Email đã tồn tại.");
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        fullName: data.fullName,
        email: data.email
      },
      include: {
        vaiTro: true
      }
    });

    res.json(ok({ user: toSafeUser(updated) }, "Cập nhật hồ sơ thành công."));
  })
);

authRouter.patch(
  "/me/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      throw new AppError(404, "Không tìm thấy người dùng.");
    }

    const valid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(400, "Mật khẩu hiện tại không đúng.");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
      include: {
        vaiTro: true
      }
    });

    res.json(ok({ user: toSafeUser(updated) }, "Đổi mật khẩu thành công."));
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (!user) {
      throw new AppError(404, "Email chưa được đăng ký.");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setPasswordResetToken(user.email || data.email, otp);

    const emailResult = await sendOtpEmail(user.email || data.email, otp);
    res.json(
      ok(
        {
          devOtp: emailResult.mode === "dev" ? emailResult.otp : null
        },
        "Đã gửi OTP đến email."
      )
    );
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const data = resetPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError(400, "OTP không hợp lệ.");
    }

    const verification = verifyPasswordResetToken(user.email || data.email, data.otp);
    if (!verification.valid) {
      throw new AppError(400, verification.reason);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(data.newPassword)
      },
      include: {
        vaiTro: true
      }
    });

    clearPasswordResetToken(user.email || data.email);

    res.json(ok({ user: toSafeUser(updated) }, "Đặt lại mật khẩu thành công."));
  })
);
