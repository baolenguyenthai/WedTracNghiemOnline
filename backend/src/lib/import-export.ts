import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import XLSX from "xlsx";
import { answerIndexFromLabel, mapDifficulty, normalizeText } from "./utils.js";

export type ImportedQuestion = {
  content: string;
  difficulty: string;
  answers: Array<{ content: string; isCorrect: boolean }>;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildAnswerSet(options: string[], correctIndex: number) {
  return options.map((content, index) => ({
    content: normalizeText(content),
    isCorrect: index === correctIndex
  }));
}

function validateQuestion(question: ImportedQuestion) {
  if (!question.content.trim()) {
    throw new Error("Câu hỏi không được trống.");
  }
  if (question.answers.length !== 4) {
    throw new Error("Mỗi câu hỏi phải có đúng 4 đáp án.");
  }
  if (question.answers.some((item) => !item.content.trim())) {
    throw new Error("Mỗi đáp án phải có nội dung.");
  }
  const correctCount = question.answers.filter((item) => item.isCorrect).length;
  if (correctCount !== 1) {
    throw new Error("Mỗi câu hỏi phải có đúng 1 đáp án đúng.");
  }
  return {
    content: normalizeText(question.content),
    difficulty: mapDifficulty(question.difficulty),
    answers: question.answers.map((answer) => ({
      content: normalizeText(answer.content),
      isCorrect: Boolean(answer.isCorrect)
    }))
  };
}

export async function parseImportedQuestions(file: Express.Multer.File) {
  const fileName = file.originalname.toLowerCase();
  if (fileName.endsWith(".csv")) {
    return parseCsvQuestions(file.buffer.toString("utf8"));
  }
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return parseExcelQuestions(file.buffer);
  }
  if (fileName.endsWith(".docx")) {
    return parseDocxQuestions(file.buffer);
  }
  throw new Error("Chỉ hỗ trợ CSV, XLSX và DOCX.");
}

function parseCsvQuestions(raw: string) {
  const rows = parseCsv(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  return rows.map((row) => {
    const headers = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
    );

    const question = headers.question || headers.cau_hoi || headers.noi_dung;
    const difficulty = headers.difficulty || headers.muc_do || "TB";
    const answers = [
      headers.a || headers.option_a || headers.dap_an_a || "",
      headers.b || headers.option_b || headers.dap_an_b || "",
      headers.c || headers.option_c || headers.dap_an_c || "",
      headers.d || headers.option_d || headers.dap_an_d || ""
    ];
    const correct = headers.correct || headers.dap_an_dung || "A";
    const correctIndex = answerIndexFromLabel(correct);
    if (correctIndex < 0) {
      throw new Error(`Đáp án đúng không hợp lệ: ${correct}`);
    }
    return validateQuestion({
      content: question,
      difficulty,
      answers: buildAnswerSet(answers, correctIndex)
    });
  });
}

function parseExcelQuestions(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return rows.map((row) => {
    const headers = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "")])
    );

    const correctIndex = answerIndexFromLabel(headers.correct || headers.dap_an_dung || "A");
    if (correctIndex < 0) {
      throw new Error(`Đáp án đúng không hợp lệ: ${headers.correct || headers.dap_an_dung}`);
    }

    return validateQuestion({
      content: headers.question || headers.cau_hoi || headers.noi_dung,
      difficulty: headers.difficulty || headers.muc_do || "TB",
      answers: buildAnswerSet(
        [headers.a || "", headers.b || "", headers.c || "", headers.d || ""],
        correctIndex
      )
    });
  });
}

function parseDocxQuestions(buffer: Buffer) {
  return mammoth.convertToHtml({ buffer }).then((result) => {
    const $ = cheerio.load(result.value);

    const questions: ImportedQuestion[] = [];
    let current: ImportedQuestion | null = null;

    $("p").each((_, element) => {
      const paragraph = $(element).text().trim();
      const html = ($(element).html() || "").toLowerCase();
      if (!paragraph) {
        return;
      }

      const questionMatch = paragraph.match(/^(?:câu\s*hỏi\s*:|question\s*:)\s*(.+)$/i);
      if (questionMatch) {
        if (current) {
          questions.push(validateQuestion(current));
        }
        current = {
          content: questionMatch[1].trim(),
          difficulty: "TB",
          answers: []
        };
        return;
      }

      const answerMatch = paragraph.match(/^([A-D])\s*[\.\)\-:]\s*(.+)$/i);
      if (answerMatch && current) {
        const isCorrect = html.includes("<strong") || html.includes("<b") || /\*(.+)|\[đúng\]|\[correct\]/i.test(paragraph);
        current.answers.push({
          content: answerMatch[2].replace(/^\*\s*/, "").replace(/\s*\[(đúng|correct)\]\s*$/i, "").trim(),
          isCorrect
        });
        return;
      }

      if (current && current.content && !current.answers.length) {
        current.content = `${current.content} ${paragraph}`.trim();
      }
    });

    if (current) {
      questions.push(validateQuestion(current));
    }

    if (!questions.length) {
      throw new Error("Không tìm thấy câu hỏi hợp lệ trong file DOCX.");
    }

    return questions;
  });
}

export async function exportQuestionsToXlsx(bankName: string, questions: Array<{
  content: string;
  difficulty: string;
  answers: Array<{ content: string; isCorrect: boolean }>;
}>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UngDungTracNghiem";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Questions");

  sheet.columns = [
    { header: "Question", key: "question", width: 48 },
    { header: "Difficulty", key: "difficulty", width: 14 },
    { header: "A", key: "a", width: 28 },
    { header: "B", key: "b", width: 28 },
    { header: "C", key: "c", width: 28 },
    { header: "D", key: "d", width: 28 },
    { header: "Correct", key: "correct", width: 12 }
  ];

  questions.forEach((question) => {
    const answers = question.answers;
    const correctIndex = answers.findIndex((answer) => answer.isCorrect);
    sheet.addRow({
      question: question.content,
      difficulty: question.difficulty,
      a: answers[0]?.content || "",
      b: answers[1]?.content || "",
      c: answers[2]?.content || "",
      d: answers[3]?.content || "",
      correct: correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : ""
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportQuestionsToDocx(bankName: string, questions: Array<{
  content: string;
  difficulty: string;
  answers: Array<{ content: string; isCorrect: boolean }>;
}>) {
  const children: Paragraph[] = [
    new Paragraph({
      text: bankName,
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph({
      text: `Tổng số câu: ${questions.length}`
    })
  ];

  questions.forEach((question, index) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Câu ${index + 1}. `,
            bold: true
          }),
          new TextRun(question.content)
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Mức độ: ${question.difficulty}`, italics: true })
        ]
      })
    );

    question.answers.forEach((answer, answerIndex) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${String.fromCharCode(65 + answerIndex)}. `,
              bold: true
            }),
            new TextRun({
              text: answer.content,
              bold: answer.isCorrect
            }),
            ...(answer.isCorrect
              ? [new TextRun({ text: " (Đúng)", bold: true, color: "1A7F37" })]
              : [])
          ]
        })
      );
    });

    children.push(new Paragraph({ text: " " }));
  });

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}
