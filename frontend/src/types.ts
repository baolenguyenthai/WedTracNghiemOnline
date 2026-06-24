export type UserRole = "ADMIN" | "USER";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  id: number;
  name: string;
}

export interface Subject {
  id: number;
  name: string;
}

export interface Answer {
  id: number;
  content: string;
  isCorrect?: boolean;
}

export interface Question {
  id: number;
  content: string;
  difficulty: string;
  answers: Answer[];
}

export interface BankSummary {
  id: number;
  name: string;
  description: string | null;
  status: string;
  isPublic: boolean;
  defaultQuestionCount: number | null;
  defaultDurationMinutes: number | null;
  grade: Grade;
  subject: Subject;
  creator?: {
    id: number;
    fullName: string;
    username: string;
    email: string;
  };
  _count?: {
    questions: number;
    exams: number;
  };
  createdAt?: string;
}

export interface ExamSummary {
  id: number;
  bankId: number;
  bankName: string;
  gradeName: string;
  subjectName: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  publicAtStart: boolean;
  questionCount: number;
}

export interface ExamQuestion {
  id: number;
  content: string;
  difficulty: string;
  answers: Array<{ id: number; content: string; isCorrect?: boolean }>;
}

export interface ExamSession {
  id: number;
  bankId: number;
  totalQuestions: number;
  startedAt: string;
  durationSeconds: number;
  publicAtStart: boolean;
  isReviewMode?: boolean;
}

export interface LeaderboardRow {
  rank: number;
  examId: number;
  userId: number;
  userName: string;
  username: string;
  bankName: string;
  gradeName: string;
  subjectName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number | null;
  submittedAt: string | null;
}

export interface FavoriteQuestionRow {
  questionId: number;
  question: string;
  difficulty: string;
  bankName: string;
  gradeName: string;
  subjectName: string;
  isPublic: boolean;
  correctAnswer: string;
  createdAt: string;
}

export interface AdminStatsOverview {
  totalUsers: number;
  activeUsers: number;
  totalBanks: number;
  pendingBanks: number;
  approvedBanks: number;
  totalExams: number;
  avgScore: number;
  topUsers: Array<{
    user: { id: number; fullName: string; username: string };
    count: number;
    avgScore: number;
    totalScore: number;
  }>;
  topSubject: {
    subjectName: string;
    count: number;
    avgScore: number;
    totalScore: number;
  } | null;
  topGrade: {
    gradeName: string;
    count: number;
    avgScore: number;
    totalScore: number;
  } | null;
  recentExams: Array<{
    examId: number;
    userName: string;
    bankName: string;
    subjectName: string;
    gradeName: string;
    score: number;
    correctCount: number;
    totalQuestions: number;
    submittedAt: string | null;
    durationSeconds: number | null;
  }>;
}

export interface AdminSubjectRow {
  subjectId: number;
  subjectName: string;
  totalBanks: number;
  totalExams: number;
  avgScore: number;
}

export interface AdminGradeRow {
  gradeId: number;
  gradeName: string;
  totalBanks: number;
  totalExams: number;
  avgScore: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
