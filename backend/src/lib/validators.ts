import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(1).max(191),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email().max(191),
  password: z.string().min(6).max(128)
});

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1).max(191),
  password: z.string().min(1).max(128)
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(191),
  email: z.string().email().max(191)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(191)
});

export const resetPasswordSchema = z.object({
  email: z.string().email().max(191),
  otp: z.string().min(4).max(32),
  newPassword: z.string().min(6).max(128)
});

export const bankQuerySchema = z.object({
  search: z.string().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  isPublic: z.coerce.boolean().optional(),
  mine: z.coerce.boolean().optional()
});

export const bankCreateSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().max(1000).optional().or(z.literal("")),
  gradeId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  isPublic: z.coerce.boolean().default(false),
  status: z.string().default("CHO_DUYET"),
  defaultQuestionCount: z.coerce.number().int().positive().max(200).optional().nullable(),
  defaultDurationMinutes: z.coerce.number().int().positive().max(600).optional().nullable()
});

export const bankUpdateSchema = bankCreateSchema.partial().extend({
  name: z.string().min(1).max(191).optional()
});

export const gradeSchema = z.object({
  name: z.string().min(1).max(191)
});

export const subjectSchema = z.object({
  name: z.string().min(1).max(191)
});

export const answerInputSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  content: z.string().min(1).max(5000),
  isCorrect: z.coerce.boolean()
});

export const questionCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  difficulty: z.string().default("TB"),
  answers: z.array(answerInputSchema).min(2)
}).refine((data) => data.answers.some((answer) => answer.isCorrect), {
  message: "Phải có ít nhất một đáp án đúng."
});

export const questionUpdateSchema = questionCreateSchema.extend({
  id: z.coerce.number().int().positive()
});

export const examStartSchema = z.object({
  bankId: z.coerce.number().int().positive(),
  questionCount: z.coerce.number().int().positive().max(200).optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().max(600).optional().nullable()
});

export const examSubmitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.coerce.number().int().positive(),
      answerId: z.coerce.number().int().positive().nullable().optional()
    })
  )
});

export const leaderboardQuerySchema = z.object({
  gradeId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional()
});

export const favoriteQuerySchema = z.object({
  gradeId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional()
});

export const aiGenerateSchema = z.object({
  bankName: z.string().min(1).max(191),
  description: z.string().max(1000).optional().or(z.literal("")),
  gradeId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive().optional(),
  subjectName: z.string().min(1).max(191).optional(),
  isPublic: z.coerce.boolean().default(false),
  questionCount: z.coerce.number().int().positive().max(50, "Số câu hỏi AI tạo tối đa là 50 câu."),
  prompt: z.string().min(5, "Nội dung yêu cầu phải có ít nhất 5 ký tự.").max(8000)
});

export const importBankSchema = z.object({
  bankName: z.string().min(1).max(191),
  description: z.string().max(1000).optional().or(z.literal("")),
  gradeId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive().optional(),
  subjectName: z.string().min(1).max(191).optional(),
  isPublic: z.coerce.boolean().default(false),
  defaultQuestionCount: z.coerce.number().int().positive().max(200).optional().nullable(),
  defaultDurationMinutes: z.coerce.number().int().positive().max(600).optional().nullable()
});
