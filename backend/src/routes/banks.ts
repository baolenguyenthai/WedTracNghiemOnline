import { Router } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { AppError, asyncHandler, ok } from "../lib/http.js";
import { aiGenerateSchema, bankCreateSchema, bankQuerySchema, importBankSchema } from "../lib/validators.js";
import { requireAuth } from "../middleware/auth.js";
import { parseImportedQuestions } from "../lib/import-export.js";
import { generateQuestionsWithGemini } from "../lib/ai.js";
import { mapDifficulty } from "../lib/utils.js";
import { createRequire } from "node:module";

export const banksRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

banksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filters = bankQuerySchema.parse(req.query);
    const where: Prisma.QuestionBankWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { subject: { name: { contains: filters.search } } }
      ];
    }
    if (filters.subjectId) {
      where.subjectId = filters.subjectId;
    }
    if (filters.gradeId) {
      where.gradeId = filters.gradeId;
    }
    if (filters.mine) {
      where.creatorId = req.user!.id;
    }
    if (req.user!.role !== "ADMIN") {
      where.status = "DA_DUYET";
    } else if (filters.status) {
      where.status = filters.status;
    }
    if (typeof filters.isPublic === "boolean") {
      where.isPublic = filters.isPublic;
    }

    const banks = await prisma.questionBank.findMany({
      where,
      include: {
        grade: true,
        subject: true,
        creator: {
          select: { id: true, fullName: true, username: true, email: true }
        },
        _count: {
          select: { questions: true, exams: true }
        }
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    res.json(ok({ banks }));
  })
);

banksRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
        grade: true,
        subject: true,
        creator: {
          select: { id: true, fullName: true, username: true }
        },
        _count: {
          select: { questions: true, exams: true }
        }
      }
    });
    if (!bank) {
      res.status(404).json({ success: false, message: "Không tìm thấy bộ câu hỏi." });
      return;
    }

    if (bank.status !== "DA_DUYET" && req.user!.role !== "ADMIN" && bank.creatorId !== req.user!.id) {
      res.status(403).json({ success: false, message: "Bộ câu hỏi chưa được duyệt." });
      return;
    }

    res.json(ok({ bank }));
  })
);

banksRouter.get(
  "/:id/preview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            answers: { orderBy: { id: 'asc' } }
          }
        }
      }
    });

    if (!bank) {
      res.status(404).json({ success: false, message: "Không tìm thấy bộ câu hỏi." });
      return;
    }

    if (bank.status !== "DA_DUYET" && req.user!.role !== "ADMIN" && bank.creatorId !== req.user!.id) {
      res.status(403).json({ success: false, message: "Bộ câu hỏi chưa được duyệt." });
      return;
    }

    const questionCount = req.query.questionCount ? Number(req.query.questionCount) : 50;
    
    // We no longer shuffle on the backend. Frontend handles shuffling to ensure unique order per player.
    const finalQuestions = bank.questions.slice(0, questionCount);

    res.json(ok({ bank, questions: finalQuestions }));
  })
);

banksRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = bankCreateSchema.parse(req.body);
    const bank = await prisma.questionBank.create({
      data: {
        name: data.name,
        description: data.description || null,
        gradeId: data.gradeId,
        subjectId: data.subjectId,
        creatorId: req.user!.id,
        status: data.status || "CHO_DUYET",
        isPublic: data.isPublic,
        defaultQuestionCount: data.defaultQuestionCount ?? null,
        defaultDurationMinutes: data.defaultDurationMinutes ?? null
      }
    });
    res.json(ok({ bank }, "Tạo bộ câu hỏi thành công."));
  })
);

banksRouter.post(
  "/parse",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") {
      throw new AppError(403, "Chỉ Quản trị viên mới được sử dụng tính năng này.");
    }
    if (!req.file) {
      throw new AppError(400, "Vui lòng chọn file.");
    }
    const questions = await parseImportedQuestions(req.file);
    if (!questions.length) {
      throw new AppError(400, "File không chứa câu hỏi hợp lệ hoặc không đúng định dạng.");
    }
    res.json(ok({ questions }, "Đã phân tích file thành công."));
  })
);

banksRouter.post(
  "/ocr",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") {
      throw new AppError(403, "Chỉ Quản trị viên mới được sử dụng tính năng này.");
    }
    if (!req.file) {
      throw new AppError(400, "Vui lòng chọn ảnh để quét.");
    }

    const mimeType = req.file.mimetype;
    if (!mimeType.startsWith("image/")) {
      throw new AppError(400, "File tải lên phải là hình ảnh (JPEG, PNG, vv).");
    }

    const base64Image = req.file.buffer.toString("base64");
    const { parseImageToQuestionsWithGemini } = await import("../lib/ai.js");
    
    // Convert GeneratedQuestion[] to ParsedQuestion format
    const questions = await parseImageToQuestionsWithGemini(base64Image, mimeType);
    
    if (!questions.length) {
      throw new AppError(400, "AI không nhận diện được câu hỏi nào từ ảnh.");
    }

    // Map to valid format with isValid flag
    const formattedQuestions = questions.map(q => {
      let isValid = true;
      const errors = [];
      if (q.answers.length !== 4) {
        isValid = false;
        errors.push("Cần đúng 4 đáp án");
      }
      if (q.answers.filter(a => a.isCorrect).length !== 1) {
        isValid = false;
        errors.push("Cần 1 đáp án đúng");
      }
      return {
        ...q,
        isValid,
        errors
      };
    });

    res.json(ok({ questions: formattedQuestions }, "Đã quét ảnh thành công."));
  })
);

const createParsedSchema = z.object({
  bankName: z.string().min(1, "Tên bộ đề không được trống"),
  description: z.string().optional(),
  subjectId: z.coerce.number().optional(),
  subjectName: z.string().optional(),
  gradeId: z.coerce.number(),
  isPublic: z.boolean().default(false),
  defaultQuestionCount: z.coerce.number().optional(),
  defaultDurationMinutes: z.coerce.number().optional(),
  questions: z.array(z.object({
    content: z.string(),
    difficulty: z.string(),
    answers: z.array(z.object({
      content: z.string(),
      isCorrect: z.boolean()
    }))
  })).min(1, "Danh sách câu hỏi không được trống")
});

banksRouter.post(
  "/create-from-parsed",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") {
      throw new AppError(403, "Chỉ Quản trị viên mới được sử dụng tính năng này.");
    }
    const data = createParsedSchema.parse(req.body);

    let finalSubjectId = data.subjectId;
    if (!finalSubjectId && data.subjectName) {
      let sub = await prisma.subject.findFirst({ where: { name: data.subjectName } });
      if (!sub) {
        sub = await prisma.subject.create({ data: { name: data.subjectName } });
      }
      finalSubjectId = sub.id;
    }
    if (!finalSubjectId) throw new AppError(400, "Vui lòng nhập tên môn học.");

    const bank = await prisma.$transaction(async (tx) => {
      return tx.questionBank.create({
        data: {
          name: data.bankName,
          description: data.description || "Bộ câu hỏi tải lên từ file",
          gradeId: data.gradeId,
          subjectId: finalSubjectId,
          creatorId: req.user!.id,
          status: "CHO_DUYET",
          isPublic: data.isPublic,
          defaultQuestionCount: data.defaultQuestionCount ?? data.questions.length,
          defaultDurationMinutes: data.defaultDurationMinutes ?? 20,
          questions: {
            create: data.questions.map((question: any) => ({
              content: question.content,
              difficulty: mapDifficulty(question.difficulty),
              answers: {
                create: question.answers.map((answer: any) => ({
                  content: answer.content,
                  isCorrect: answer.isCorrect
                }))
              }
            }))
          }
        },
        include: { questions: { include: { answers: { orderBy: { id: 'asc' } } } } }
      });
    });

    res.json(ok({ bank, questionCount: data.questions.length }, "Đã lưu bộ câu hỏi và gửi duyệt."));
  })
);

banksRouter.post(
  "/ai",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN") {
      throw new AppError(403, "Chỉ Quản trị viên mới được sử dụng tính năng này.");
    }

    // When file is uploaded via FormData, fields come as strings in req.body
    const bodyData = {
      ...req.body,
      gradeId: Number(req.body.gradeId),
      questionCount: Number(req.body.questionCount),
      isPublic: req.body.isPublic === "true" || req.body.isPublic === true
    };
    const data = aiGenerateSchema.parse(bodyData);
    
    // Extract text from uploaded file if present
    let fileContent = "";
    if (req.file) {
      const mime = req.file.mimetype;
      const buffer = req.file.buffer;
      
      if (mime === "application/pdf") {
        try {
          const require = createRequire(import.meta.url);
          const pdfParse = require("pdf-parse");
          const pdfData = await pdfParse(buffer);
          fileContent = pdfData.text;
        } catch (err) {
          console.error("PDF Parsing Error:", err);
          throw new AppError(400, "Không thể đọc file PDF. Vui lòng thử file khác.");
        }
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/msword"
      ) {
        try {
          const mammothLib = (await import("mammoth")) as any;
          const extract = mammothLib.default?.extractRawText || mammothLib.extractRawText;
          const result = await extract({ buffer });
          fileContent = result.value;
        } catch {
          throw new AppError(400, "Không thể đọc file Word. Vui lòng thử file khác.");
        }
      } else if (mime === "text/plain") {
        fileContent = buffer.toString("utf-8");
      } else {
        throw new AppError(400, "Định dạng file không hỗ trợ. Vui lòng chọn PDF, Word (.docx) hoặc TXT.");
      }
    }

    let finalSubjectId = data.subjectId;
    if (!finalSubjectId && data.subjectName) {
      let sub = await prisma.subject.findFirst({ where: { name: data.subjectName } });
      if (!sub) {
        sub = await prisma.subject.create({ data: { name: data.subjectName } });
      }
      finalSubjectId = sub.id;
    }
    if (!finalSubjectId) throw new AppError(400, "Vui lòng nhập tên môn học.");

    const [grade, subject] = await Promise.all([
      prisma.grade.findUnique({ where: { id: data.gradeId } }),
      prisma.subject.findUnique({ where: { id: finalSubjectId } })
    ]);
    if (!grade || !subject) {
      throw new AppError(404, "Không tìm thấy cấp học hoặc môn học.");
    }

    // Build prompt with optional file content
    let fullPrompt = `${data.prompt}\n\nCấp học: ${grade.name}\nMôn học: ${subject.name}\nSố câu hỏi: ${data.questionCount}`;
    if (fileContent.trim()) {
      // Limit to ~15000 chars to avoid token overflow
      const trimmedContent = fileContent.trim().substring(0, 15000);
      fullPrompt += `\n\nDưới đây là nội dung tài liệu tham khảo để tạo câu hỏi:\n---\n${trimmedContent}\n---`;
    }

    const generatedQuestions = await generateQuestionsWithGemini(fullPrompt);

    const preparedQuestions = generatedQuestions.slice(0, data.questionCount).map((question) => ({
      content: question.content,
      difficulty: mapDifficulty(question.difficulty),
      answers: question.answers.slice(0, 4).map((answer) => ({
        content: answer.content,
        isCorrect: Boolean(answer.isCorrect)
      }))
    }));

    if (!preparedQuestions.length) {
      throw new AppError(400, "AI không tạo được câu hỏi hợp lệ.");
    }
    if (
      preparedQuestions.some(
        (question) =>
          question.answers.length !== 4 ||
          question.answers.some((answer) => !answer.content.trim()) ||
          question.answers.filter((answer) => answer.isCorrect).length !== 1
      )
    ) {
      throw new AppError(400, "AI phải tạo đúng 4 đáp án và 1 đáp án đúng cho mỗi câu.");
    }

    const bank = await prisma.$transaction(async (tx) => {
      const createdBank = await tx.questionBank.create({
        data: {
          name: data.bankName,
          description: data.description || "Bộ câu hỏi tạo bằng AI",
          gradeId: data.gradeId,
          subjectId: finalSubjectId,
          creatorId: req.user!.id,
          status: "CHO_DUYET",
          isPublic: data.isPublic,
          defaultQuestionCount: preparedQuestions.length,
          defaultDurationMinutes: 20,
          questions: {
            create: preparedQuestions.map((question) => ({
              content: question.content,
              difficulty: question.difficulty,
              answers: {
                create: question.answers.map((answer) => ({
                  content: answer.content,
                  isCorrect: answer.isCorrect
                }))
              }
            }))
          }
        },
        include: { questions: { include: { answers: { orderBy: { id: 'asc' } } } } }
      });

      return createdBank;
    });

    res.json(
      ok(
        {
          bank,
          questionCount: preparedQuestions.length
        },
        "Đã tạo bộ câu hỏi bằng AI và gửi duyệt."
      )
    );
  })
);
