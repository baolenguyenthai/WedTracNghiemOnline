import type { Question, Answer } from "@prisma/client";

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
}

export function clampNumber(value: number | undefined | null, fallback: number, min: number, max: number) {
  const candidate = Number.isFinite(value ?? NaN) ? Number(value) : fallback;
  return Math.max(min, Math.min(max, Math.floor(candidate)));
}

export function questionHasCorrectAnswer(answers: Pick<Answer, "isCorrect">[]) {
  return answers.some((answer) => answer.isCorrect);
}

export function answerIndexFromLabel(label: string) {
  const normalized = label.trim().toUpperCase();
  if (["A", "1"].includes(normalized)) return 0;
  if (["B", "2"].includes(normalized)) return 1;
  if (["C", "3"].includes(normalized)) return 2;
  if (["D", "4"].includes(normalized)) return 3;
  return -1;
}

export function toExamScore(correctCount: number, totalQuestions: number) {
  if (totalQuestions <= 0) return 0;
  // Trả về số nguyên (0-100)
  return Math.round((correctCount / totalQuestions) * 100);
}

export function bankLabel(bank: {
  isPublic: boolean;
  defaultQuestionCount: number | null;
  defaultDurationMinutes: number | null;
}) {
  return {
    questionCount: bank.isPublic ? null : bank.defaultQuestionCount,
    durationMinutes: bank.isPublic ? null : bank.defaultDurationMinutes
  };
}

export function mapDifficulty(difficulty?: string | null) {
  const value = (difficulty || "TB").toUpperCase();
  if (["DE", "TB", "KHO"].includes(value)) return value;
  return "TB";
}

export function safeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isQuestionEntity(value: unknown): value is Question {
  return Boolean(value && typeof value === "object" && "id" in (value as Record<string, unknown>));
}
