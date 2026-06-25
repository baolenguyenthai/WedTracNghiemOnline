import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().default("lenguyenthaib@gmail.com"),
  SMTP_PASS: z.string().default("pvvqqydujswlfwst"),
  SMTP_FROM: z.string().default('"Trắc Nghiệm Online" <lenguyenthaib@gmail.com>'),
  RESEND_API_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);
