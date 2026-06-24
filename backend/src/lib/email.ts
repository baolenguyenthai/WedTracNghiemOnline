import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

export async function sendOtpEmail(targetEmail: string, otp: string) {
  if (!hasSmtpConfig()) {
    if (env.NODE_ENV !== "production") {
      return { mode: "dev", otp };
    }
    throw new AppError(500, "Hệ thống chưa được cấu hình Email (SMTP). Vui lòng thêm các biến môi trường SMTP trên Render.");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: targetEmail,
    subject: "OTP đặt lại mật khẩu",
    text: `Mã OTP của bạn là: ${otp}\n\nKhông chia sẻ mã này với người khác.`
  });

  return { mode: "smtp", otp: null };
}
