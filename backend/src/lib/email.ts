import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

export async function sendOtpEmail(targetEmail: string, otp: string) {
  if (env.RESEND_API_KEY) {
    // Dùng Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Acme <onboarding@resend.dev>",
        to: targetEmail,
        subject: "OTP đặt lại mật khẩu",
        text: `Mã OTP của bạn là: ${otp}\n\nKhông chia sẻ mã này với người khác.`
      })
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("Resend error:", errorData);
      throw new AppError(500, "Lỗi khi gửi email qua Resend.");
    }
    return { mode: "resend", otp: null };
  }

  const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
  if (!hasSmtpConfig) {
    if (env.NODE_ENV !== "production") {
      return { mode: "dev", otp };
    }
    throw new AppError(500, "Hệ thống chưa được cấu hình Email. Vui lòng thêm RESEND_API_KEY hoặc cấu hình SMTP.");
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
