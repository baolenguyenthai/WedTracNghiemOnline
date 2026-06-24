import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Filter,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  Medal,
  Plus,
  RefreshCcw,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPen,
  Users,
  X,
  FileUp,
  FileDown,
  Save,
  Clock3,
  ListOrdered,
  PencilLine,
  BarChart3,
  SaveAll,
  TimerReset,
  Trophy,
  Crown,
  Award,
  TrendingUp,
  Activity,
  Zap,
  FileText,
  Eye
} from "lucide-react";
import { apiFetch, getApiBase } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  MetricCard,
  Section,
  Subsection,
  Select,
  Table,
  Textarea,
  Toggle,
  LoadingState
} from "@/components/common";
import { WorkspaceLayout, adminNavItems, userNavItems } from "@/components/layout";
import { GamificationSection } from "@/components/GamificationSection";
import { FlashcardSection } from "@/components/FlashcardSection";
import { MultiplayerSection } from "@/components/MultiplayerSection";
import { BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type {
  AdminGradeRow,
  AdminStatsOverview,
  AdminSubjectRow,
  AuthUser,
  BankSummary,
  ExamSummary,
  FavoriteQuestionRow,
  Grade,
  LeaderboardRow,
  Question,
  Subject
} from "@/types";

type CatalogData = {
  grades: Grade[];
  subjects: Subject[];
};

function useCatalog(token: string | null) {
  const [data, setData] = useState<CatalogData>({ grades: [], subjects: [] });
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [grades, subjects] = await Promise.all([
        apiFetch<{ grades: Grade[] }>("/meta/grades", {}, token),
        apiFetch<{ subjects: Subject[] }>("/meta/subjects", {}, token)
      ]);
      setData({
        grades: grades.data.grades,
        subjects: subjects.data.subjects
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  return { ...data, loading, refresh, setData };
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Chưa có";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) {
    return "Chưa rõ";
  }
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}m ${String(remain).padStart(2, "0")}s`;
}

async function downloadFile(token: string | null, path: string, fileName: string) {
  if (!token) {
    throw new Error("Thiếu phiên đăng nhập.");
  }
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function roleLabel(role?: string) {
  return role === "ADMIN" ? "Quản trị" : "Học viên";
}

function statusLabel(status: string) {
  switch (status) {
    case "DA_DUYET": return "Đã duyệt";
    case "CHO_DUYET": return "Chờ duyệt";
    case "TU_CHOI": return "Từ chối";
    default: return status;
  }
}

function statusTone(status: string): "success" | "warning" | "danger" {
  switch (status) {
    case "DA_DUYET": return "success";
    case "CHO_DUYET": return "warning";
    case "TU_CHOI": return "danger";
    default: return "warning";
  }
}

export function WorkspacePage() {
  const { user, token, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useCatalog(token);
  const role = user?.role || "USER";
  const navItems = role === "ADMIN" ? adminNavItems : userNavItems;
  const defaultSection = role === "ADMIN" ? "overview" : "explore";
  const section = searchParams.get("section") || defaultSection;

  useEffect(() => {
    if (!searchParams.get("section")) {
      const next = new URLSearchParams(searchParams);
      next.set("section", defaultSection);
      setSearchParams(next, { replace: true });
    }
  }, [defaultSection, searchParams, setSearchParams]);

  const setSection = (nextSection: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", nextSection);
    setSearchParams(next, { replace: true });
  };

  return (
    <WorkspaceLayout
      title={role === "ADMIN" ? "Bảng điều khiển" : "Khu vực học tập"}
      subtitle={role === "ADMIN" ? "Quản lý toàn bộ hệ thống trắc nghiệm." : "Làm bài, xem kết quả và quản lý bộ đề."}
      sections={navItems}
    >
      {(activeSection) => {
        if (role === "ADMIN") {
          return (
            <div className="stack">
              {activeSection === "overview" ? <AdminOverviewSection token={token} /> : null}
              {activeSection === "users" ? <AdminUsersSection token={token} onUserUpdated={setUser} /> : null}
              {activeSection === "banks" ? <AdminBanksSection token={token} catalog={catalog} /> : null}
              {activeSection === "exams" ? <AdminExamsSection token={token} /> : null}
              {activeSection === "catalog" ? <AdminCatalogSection token={token} catalog={catalog} /> : null}
              {activeSection === "upload" ? <UploadSection token={token} catalog={catalog} /> : null}
              {activeSection === "stats" ? <AdminStatsSection token={token} /> : null}
              {activeSection === "profile" ? <ProfileSection token={token} onProfileUpdated={setUser} /> : null}
            </div>
          );
        }

        return (
          <div className="stack">
            {activeSection === "explore" ? <ExploreSection token={token} catalog={catalog} /> : null}
            {activeSection === "history" ? <HistorySection token={token} /> : null}
            {activeSection === "multiplayer" ? <MultiplayerSection token={token} user={user} catalog={catalog} /> : null}
            {activeSection === "flashcards" ? <FlashcardSection token={token} /> : null}
            {activeSection === "favorites" ? <FavoritesSection token={token} catalog={catalog} /> : null}
            {activeSection === "leaderboard" ? (
              <>
                <GamificationSection token={token} />
                <LeaderboardSection token={token} catalog={catalog} />
              </>
            ) : null}
            {activeSection === "upload" ? <UploadSection token={token} catalog={catalog} /> : null}
            {activeSection === "profile" ? <ProfileSection token={token} onProfileUpdated={setUser} /> : null}
          </div>
        );
      }}
    </WorkspaceLayout>
  );
}

/* ═══════════════════════════════════════════════
   EXPLORE SECTION
   ═══════════════════════════════════════════════ */
function ExploreSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: CatalogData;
}) {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<BankSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    gradeId: "",
    subjectId: ""
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.gradeId) params.set("gradeId", filters.gradeId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const response = await apiFetch<{ banks: BankSummary[] }>(`/banks?${params.toString()}`, {}, token);
      setBanks(response.data.banks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách đề.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <Section
      title="Khám phá bộ đề"
      subtitle="Tìm và lọc bộ đề đã duyệt theo môn học, cấp học."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }} style={{ marginBottom: "0.75rem", gap: "0.5rem" }}>
        <Input
          value={filters.search}
          onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))}
          placeholder="Tìm bộ đề..."
          style={{ maxWidth: 260 }}
        />
        <Select
          value={filters.gradeId}
          onChange={(event) => setFilters((value) => ({ ...value, gradeId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Cấp học</option>
          {catalog.grades.map((grade) => (
            <option key={grade.id} value={grade.id}>{grade.name}</option>
          ))}
        </Select>
        <Select
          value={filters.subjectId}
          onChange={(event) => setFilters((value) => ({ ...value, subjectId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Môn học</option>
          {catalog.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </Select>
        <Button type="submit" size="sm">
          <Search size={14} />
          <span>Lọc</span>
        </Button>
      </form>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <LoadingState /> : null}
      {!loading && !banks.length ? (
        <EmptyState title="Chưa có bộ đề phù hợp" description="Hãy thử đổi bộ lọc hoặc chờ admin duyệt thêm đề." />
      ) : null}

      <div className="list scrollable-list">
        {banks.map((bank) => (
          <div key={bank.id} className="row-card">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>{bank.subject?.name || "Bộ đề"}</h3>
              <p style={{ marginBottom: "0.5rem" }}>{bank.name}</p>
              <div className="toolbar" style={{ gap: "0.35rem" }}>
                <Badge tone={bank.isPublic ? "success" : "warning"}>{bank.isPublic ? "Công khai" : "Cài sẵn"}</Badge>
                <Badge tone={statusTone(bank.status)}>{statusLabel(bank.status)}</Badge>
                <Badge tone="neutral">{bank.grade?.name}</Badge>
                <Badge tone="neutral">{bank._count?.questions || 0} câu</Badge>
                <Badge tone="primary">{bank._count?.exams || 0} lượt thi</Badge>
              </div>
              <div className="section-note" style={{ marginTop: "0.4rem" }}>
                Tạo bởi {bank.creator?.fullName || "N/A"}
              </div>
            </div>
            <Button size="sm" onClick={() => navigate(`/exam/${bank.id}`)}>
              <Play size={14} />
              <span>Làm bài</span>
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   HISTORY SECTION
   ═══════════════════════════════════════════════ */
function HistorySection({ token }: { token: string | null }) {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await apiFetch<{ exams: ExamSummary[] }>("/exams/mine", {}, token);
      setExams(response.data.exams);
      if (!selected && response.data.exams[0]) {
        setSelected(response.data.exams[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (examId: number) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const response = await apiFetch<{ exam: any }>(`/exams/${examId}`, {}, token);
      setDetail(response.data.exam);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    if (selected) {
      void loadDetail(selected);
    }
  }, [selected]);

  return (
    <div className="split" style={{ alignItems: "start" }}>
      <Section
        title="Lịch sử làm bài"
        subtitle="Danh sách các lần thi."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCcw size={14} />
            <span>Tải lại</span>
          </Button>
        }
      >
        <div className="stack">
          {loading ? <LoadingState /> : null}
          {!loading && !exams.length ? <EmptyState title="Chưa có lịch sử" description="Hãy bắt đầu một bài thi để hệ thống ghi kết quả." /> : null}
          <div className="list scrollable-list">
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                className="row-card"
                onClick={() => setSelected(exam.id)}
                style={{
                  textAlign: "left",
                  borderColor: selected === exam.id ? "rgba(139,92,246,0.3)" : undefined,
                  background: selected === exam.id ? "var(--primary-muted)" : undefined
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ wordBreak: "break-word" }}>{exam.subjectName}</h3>
                  <p style={{ wordBreak: "break-word", marginTop: "0.25rem" }}>{exam.bankName}</p>
                  <div className="toolbar" style={{ marginTop: "0.4rem", gap: "0.3rem" }}>
                    <Badge tone={exam.submittedAt ? "success" : "warning"}>{exam.submittedAt ? "Đã nộp" : "Đang thi"}</Badge>
                    <Badge tone="neutral">{Math.round(exam.score)} đ</Badge>
                    <Badge tone="neutral">{exam.correctCount}/{exam.totalQuestions}</Badge>
                  </div>
                </div>
                <div className="section-note" style={{ flexShrink: 0 }}>{formatDateTime(exam.submittedAt || exam.startedAt)}</div>
              </button>
            ))}
          </div>
        </div>
      </Section>
      <Section
        title="Chi tiết bài thi"
        subtitle={detail ? `${detail.bankName} · ${detail.user?.fullName || "Học viên"}` : "Chọn một bài thi để xem kết quả."}
      >
        {detailLoading ? <LoadingState /> : null}
        {!detailLoading && detail ? (
          <div className="stack">
            <div className="toolbar" style={{ gap: "0.35rem" }}>
              <Badge tone="primary">{detail.subjectName}</Badge>
              <Badge tone="neutral">{detail.gradeName}</Badge>
              <Badge tone="success">{detail.score.toFixed(1)} điểm</Badge>
              <Badge tone="neutral">{detail.correctCount}/{detail.totalQuestions}</Badge>
              <Badge tone="neutral">{formatDuration(detail.durationSeconds)}</Badge>
            </div>
            <div className="list scrollable-list">
              {detail.items?.map((item: any, index: number) => (
                <div key={item.id} className="question-card">
                  <div className="toolbar">
                    <Badge tone={item.isCorrect ? "success" : "danger"}>{item.isCorrect ? "✓ Đúng" : "✗ Sai"}</Badge>
                    <Badge tone="neutral">Câu {index + 1}</Badge>
                  </div>
                  <h4>{item.questionContent}</h4>
                  <div className="question-options">
                    <div className={`question-option ${item.isCorrect ? "question-option-correct" : ""}`}>
                      <strong>Chọn</strong>
                      <span>{item.selectedAnswerContent || "Chưa chọn"}</span>
                    </div>
                    <div className="question-option question-option-correct">
                      <strong>Đúng</strong>
                      <span>{item.correctAnswerContent || "Không có"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Chọn một bài thi để xem chi tiết" />
        )}
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   FAVORITES SECTION
   ═══════════════════════════════════════════════ */
function FavoritesSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: CatalogData;
}) {
  const [favorites, setFavorites] = useState<FavoriteQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    gradeId: "",
    subjectId: ""
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.gradeId) params.set("gradeId", filters.gradeId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const response = await apiFetch<{ favorites: FavoriteQuestionRow[] }>(`/favorites?${params.toString()}`, {}, token);
      setFavorites(response.data.favorites);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const toggleFavorite = async (questionId: number) => {
    if (!token) return;
    await apiFetch(`/favorites/${questionId}`, { method: "POST" }, token);
    await load();
  };

  return (
    <Section
      title="Câu hỏi yêu thích"
      subtitle="Lưu lại những câu muốn ôn tập."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      <div className="toolbar" style={{ marginBottom: "0.75rem", gap: "0.5rem" }}>
        <Select
          value={filters.gradeId}
          onChange={(event) => setFilters((value) => ({ ...value, gradeId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Cấp học</option>
          {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
        </Select>
        <Select
          value={filters.subjectId}
          onChange={(event) => setFilters((value) => ({ ...value, subjectId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Môn học</option>
          {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </Select>
        <Button size="sm" onClick={() => void load()}>
          <Filter size={14} />
          <span>Lọc</span>
        </Button>
      </div>

      {loading ? <LoadingState /> : null}
      {!loading && !favorites.length ? <EmptyState title="Chưa có câu hỏi yêu thích" description="Trong bài thi, bạn có thể đánh dấu những câu muốn ôn lại." /> : null}

      <div className="question-list scrollable-list">
        {favorites.map((item) => (
          <div key={item.questionId} className="question-card">
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <div className="toolbar" style={{ gap: "0.3rem" }}>
                <Badge tone="primary">{item.subjectName}</Badge>
                <Badge tone="neutral">{item.gradeName}</Badge>
                <Badge tone={item.isPublic ? "success" : "warning"}>{item.isPublic ? "Công khai" : "Riêng tư"}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toggleFavorite(item.questionId)}>
                <Heart size={14} />
                <span>Bỏ</span>
              </Button>
            </div>
            <h4>{item.question}</h4>
            <div className="question-options">
              <div className="question-option question-option-correct">
                <strong>Đáp án</strong>
                <span>{item.correctAnswer}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   LEADERBOARD SECTION
   ═══════════════════════════════════════════════ */
function LeaderboardSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: CatalogData;
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    gradeId: "",
    subjectId: ""
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.gradeId) params.set("gradeId", filters.gradeId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const response = await apiFetch<{ leaderboard: LeaderboardRow[] }>(`/exams/leaderboard?${params.toString()}`, {}, token);
      setRows(response.data.leaderboard);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={14} style={{ color: "#fbbf24" }} />;
    if (rank === 2) return <Award size={14} style={{ color: "#94a3b8" }} />;
    if (rank === 3) return <Medal size={14} style={{ color: "#d97706" }} />;
    return <span style={{ color: "var(--text-tertiary)", fontWeight: 700, fontSize: "0.8rem" }}>{rank}</span>;
  };

  return (
    <Section
      title="Bảng xếp hạng"
      subtitle="So sánh kết quả theo môn học và cấp học."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      <div className="toolbar" style={{ marginBottom: "0.75rem", gap: "0.5rem" }}>
        <Select
          value={filters.gradeId}
          onChange={(event) => setFilters((value) => ({ ...value, gradeId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Cấp học</option>
          {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
        </Select>
        <Select
          value={filters.subjectId}
          onChange={(event) => setFilters((value) => ({ ...value, subjectId: event.target.value }))}
          style={{ maxWidth: 150 }}
        >
          <option value="">Môn học</option>
          {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </Select>
        <Button size="sm" onClick={() => void load()}>
          <Search size={14} />
          <span>Lọc</span>
        </Button>
      </div>

      {loading ? <LoadingState /> : null}

      <div className="stack scrollable-list">
        <Table headers={["Hạng", "Họ tên", "Môn", "Cấp", "Điểm", "Kết quả", "Thời gian"]}>
          {rows.map((row) => (
            <tr key={row.examId}>
              <td style={{ width: 50 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {rankIcon(row.rank)}
                </div>
              </td>
              <td>
                <strong>{row.userName}</strong>
                <div className="section-note">@{row.username}</div>
              </td>
              <td>{row.subjectName}</td>
              <td>{row.gradeName}</td>
              <td><strong style={{ color: "var(--primary-hover)" }}>{Math.round(row.score)}<span style={{ fontSize: "0.7em", opacity: 0.6 }}>/10</span></strong></td>
              <td>{row.correctCount}/{row.totalQuestions}</td>
              <td>{formatDuration(row.durationSeconds)}</td>
            </tr>
          ))}
        </Table>
      </div>
      {!loading && !rows.length ? <EmptyState title="Chưa có dữ liệu xếp hạng" /> : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   UPLOAD SECTION
   ═══════════════════════════════════════════════ */
function UploadSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: CatalogData;
}) {
  const [mode, setMode] = useState<"file" | "ai">("file");
  const [fileForm, setFileForm] = useState({
    bankName: "",
    description: "",
    gradeId: "",
    subjectName: "",
    isPublic: false,
    defaultQuestionCount: "20",
    defaultDurationMinutes: "20"
  });
  const [aiForm, setAiForm] = useState({
    bankName: "",
    description: "",
    gradeId: "",
    subjectName: "",
    isPublic: false,
    questionCount: "5",
    prompt: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [generatedBank, setGeneratedBank] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitFile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (!fileForm.bankName.trim() || !fileForm.gradeId || !fileForm.subjectName.trim() || !file) {
      setError("Vui lòng điền đầy đủ Tên bộ đề, Cấp học, Môn học và chọn File tải lên.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      Object.entries(fileForm).forEach(([key, value]) => {
        formData.set(key, String(value));
      });
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/banks/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Tải lên thất bại.");
      }
      setMessage(`Đã gửi ${json.data.questionCount} câu hỏi để duyệt.`);
      setGeneratedBank(json.data.bank);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải file.");
    } finally {
      setLoading(false);
    }
  };

  const submitAi = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (!aiForm.bankName.trim() || !aiForm.gradeId || !aiForm.subjectName.trim() || !aiForm.prompt.trim() || !aiForm.questionCount) {
      setError("Vui lòng điền đầy đủ Tên bộ đề, Cấp học, Môn học, Số câu hỏi và Nội dung cho AI.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ bank: BankSummary; questionCount: number }>("/banks/ai", {
        method: "POST",
        body: JSON.stringify({
          ...aiForm,
          gradeId: Number(aiForm.gradeId),
          questionCount: Number(aiForm.questionCount)
        })
      }, token);
      setMessage(`AI đã tạo ${response.data.questionCount} câu hỏi.`);
      setGeneratedBank(response.data.bank);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo đề bằng AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="Tải lên / Tạo bằng AI" subtitle="Nhập file hoặc nhờ AI tạo bộ câu hỏi.">
      <div className="tab-list" style={{ marginBottom: "1rem" }}>
        <button type="button" className={`tab-button ${mode === "file" ? "tab-button-active" : ""}`} onClick={() => setMode("file")}>
          <FileUp size={14} style={{ marginRight: "0.35rem" }} />
          Tải file
        </button>
        <button type="button" className={`tab-button ${mode === "ai" ? "tab-button-active" : ""}`} onClick={() => setMode("ai")}>
          <Sparkles size={14} style={{ marginRight: "0.35rem" }} />
          Tạo bằng AI
        </button>
      </div>

      {mode === "file" ? (
        <form className="stack" onSubmit={submitFile}>
          <div className="form-grid form-columns-2">
            <label className="field-group">
              <span>Tên bộ đề</span>
              <Input value={fileForm.bankName} onChange={(event) => setFileForm((value) => ({ ...value, bankName: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Mô tả</span>
              <Input value={fileForm.description} onChange={(event) => setFileForm((value) => ({ ...value, description: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Cấp học</span>
              <Select value={fileForm.gradeId} onChange={(event) => setFileForm((value) => ({ ...value, gradeId: event.target.value }))}>
                <option value="">Chọn cấp học</option>
                {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </Select>
            </label>
            <label className="field-group">
              <span>Môn học</span>
              <Input value={fileForm.subjectName} onChange={(event) => setFileForm((value) => ({ ...value, subjectName: event.target.value }))} placeholder="Nhập tên môn học..." />
            </label>
            <label className="field-group">
              <span>Số câu mặc định</span>
              <Input value={fileForm.defaultQuestionCount} onChange={(event) => setFileForm((value) => ({ ...value, defaultQuestionCount: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Thời gian (phút)</span>
              <Input value={fileForm.defaultDurationMinutes} onChange={(event) => setFileForm((value) => ({ ...value, defaultDurationMinutes: event.target.value }))} />
            </label>
          </div>
          <Toggle checked={fileForm.isPublic} onChange={(checked) => setFileForm((value) => ({ ...value, isPublic: checked }))} label="Cho phép chỉnh số câu khi làm bài" />
          <label className="field-group">
            <span>Chọn file</span>
            <Input type="file" accept=".csv,.xlsx,.xls,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <div className="section-note">CSV/XLSX cần các cột: question, difficulty, A, B, C, D, correct. DOCX hỗ trợ câu hỏi bắt đầu bằng "Câu hỏi:" và đáp án A-D.</div>
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />}
            <span>{loading ? "Đang tải..." : "Tải lên"}</span>
          </Button>
        </form>
      ) : (
        <form className="stack" onSubmit={submitAi}>
          <div className="form-grid form-columns-2">
            <label className="field-group">
              <span>Tên bộ đề</span>
              <Input value={aiForm.bankName} onChange={(event) => setAiForm((value) => ({ ...value, bankName: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Mô tả</span>
              <Input value={aiForm.description} onChange={(event) => setAiForm((value) => ({ ...value, description: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Cấp học</span>
              <Select value={aiForm.gradeId} onChange={(event) => setAiForm((value) => ({ ...value, gradeId: event.target.value }))}>
                <option value="">Chọn cấp học</option>
                {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </Select>
            </label>
            <label className="field-group">
              <span>Môn học</span>
              <Input value={aiForm.subjectName} onChange={(event) => setAiForm((value) => ({ ...value, subjectName: event.target.value }))} placeholder="Nhập tên môn học..." />
            </label>
            <label className="field-group">
              <span>Số câu hỏi</span>
              <Input value={aiForm.questionCount} onChange={(event) => setAiForm((value) => ({ ...value, questionCount: event.target.value }))} />
            </label>
          </div>
          <Toggle checked={aiForm.isPublic} onChange={(checked) => setAiForm((value) => ({ ...value, isPublic: checked }))} label="Cho phép chỉnh số câu khi làm bài" />
          <label className="field-group">
            <span>Nội dung cho AI</span>
            <Textarea value={aiForm.prompt} onChange={(event) => setAiForm((value) => ({ ...value, prompt: event.target.value }))} placeholder="Ví dụ: tạo câu hỏi về hàm số bậc nhất, mức độ dễ đến khó..." />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{loading ? "Đang tạo..." : "Tạo bộ đề"}</span>
          </Button>
        </form>
      )}

      {generatedBank ? (
        <Subsection title="Kết quả tạo bộ đề" subtitle="Danh sách câu hỏi và đáp án đã được tạo.">
          <div style={{ marginBottom: "1rem" }}>
            <strong>{generatedBank.name}</strong>
            <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>{generatedBank.description}</p>
          </div>
          <div className="stack" style={{ gap: "1rem" }}>
            {generatedBank.questions?.map((q: any, i: number) => (
              <div key={q.id || i} className="card stack" style={{ padding: "1.25rem", gap: "0.75rem", borderLeft: "4px solid var(--primary)" }}>
                <h4 style={{ margin: 0, fontSize: "1rem", lineHeight: 1.5 }}>
                  Câu {i + 1}: {q.content}
                </h4>
                <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  {q.answers?.map((a: any, j: number) => (
                    <div key={a.id || j} style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid",
                      background: a.isCorrect ? "var(--success-muted)" : "var(--bg-surface)",
                      borderColor: a.isCorrect ? "var(--success-border)" : "var(--border)",
                      display: "flex",
                      alignItems: "center"
                    }}>
                      <strong style={{ marginRight: "0.75rem", color: a.isCorrect ? "var(--success)" : "var(--text-secondary)" }}>
                        {String.fromCharCode(65 + j)}.
                      </strong>
                      <span style={{ flex: 1, color: a.isCorrect ? "var(--success)" : "inherit" }}>{a.content}</span>
                      {a.isCorrect && <Badge tone="success">Đúng</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(!generatedBank.questions || generatedBank.questions.length === 0) && (
              <div style={{ padding: "1rem", textAlign: "center", opacity: 0.6 }}>Chưa có câu hỏi nào được trả về.</div>
            )}
          </div>
        </Subsection>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   PROFILE SECTION
   ═══════════════════════════════════════════════ */
function ProfileSection({
  token,
  onProfileUpdated
}: {
  token: string | null;
  onProfileUpdated: (user: AuthUser) => void;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || ""
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile({
      fullName: user?.fullName || "",
      email: user?.email || ""
    });
  }, [user]);

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ user: AuthUser }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(profile)
      }, token);
      onProfileUpdated(response.data.user);
      setMessage("Đã cập nhật hồ sơ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật hồ sơ.");
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify(password)
      }, token);
      setPassword({ currentPassword: "", newPassword: "" });
      setMessage("Đã đổi mật khẩu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu.");
    }
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";

  return (
    <Section title="Hồ sơ" subtitle="Cập nhật thông tin cá nhân và đổi mật khẩu.">
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", padding: "1rem", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
            display: "grid",
            placeItems: "center",
            fontSize: "1.1rem",
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0
          }}
        >
          {userInitial}
        </span>
        <div>
          <div style={{ fontWeight: 700 }}>{user?.fullName}</div>
          <div className="section-note">@{user?.username} · {user?.email}</div>
        </div>
        <div className="toolbar" style={{ marginLeft: "auto", gap: "0.35rem" }}>
          <Badge tone={user?.role === "ADMIN" ? "warning" : "primary"}>{roleLabel(user?.role)}</Badge>
          <Badge tone={user?.status === "ACTIVE" ? "success" : "danger"}>{user?.status}</Badge>
        </div>
      </div>

      <div className="section-grid columns-2">
        <form className="stack" onSubmit={updateProfile}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-secondary)" }}>Thông tin cá nhân</h3>
          <label className="field-group">
            <span>Họ tên</span>
            <Input value={profile.fullName} onChange={(event) => setProfile((value) => ({ ...value, fullName: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Email</span>
            <Input type="email" value={profile.email} onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))} />
          </label>
          <Button type="submit" size="sm">
            <Save size={14} />
            <span>Lưu hồ sơ</span>
          </Button>
        </form>

        <form className="stack" onSubmit={changePassword}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-secondary)" }}>Đổi mật khẩu</h3>
          <label className="field-group">
            <span>Mật khẩu hiện tại</span>
            <Input type="password" value={password.currentPassword} onChange={(event) => setPassword((value) => ({ ...value, currentPassword: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Mật khẩu mới</span>
            <Input type="password" value={password.newPassword} onChange={(event) => setPassword((value) => ({ ...value, newPassword: event.target.value }))} />
          </label>
          <Button type="submit" variant="secondary" size="sm">
            <ShieldCheck size={14} />
            <span>Đổi mật khẩu</span>
          </Button>
        </form>
      </div>
      {error ? <div className="form-error" style={{ marginTop: "1rem" }}>{error}</div> : null}
      {message ? <div className="form-success" style={{ marginTop: "1rem" }}>{message}</div> : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN: OVERVIEW
   ═══════════════════════════════════════════════ */
function AdminOverviewSection({ token }: { token: string | null }) {
  const [stats, setStats] = useState<AdminStatsOverview | null>(null);
  const [subjects, setSubjects] = useState<AdminSubjectRow[]>([]);
  const [grades, setGrades] = useState<AdminGradeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overview, bySubject, byGrade] = await Promise.all([
        apiFetch<AdminStatsOverview>("/admin/stats/overview", {}, token),
        apiFetch<{ rows: AdminSubjectRow[] }>("/admin/stats/by-subject", {}, token),
        apiFetch<{ rows: AdminGradeRow[] }>("/admin/stats/by-grade", {}, token)
      ]);
      setStats(overview.data);
      setSubjects(bySubject.data.rows);
      setGrades(byGrade.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <Section
      title="Tổng quan hệ thống"
      subtitle="Các con số chính và hoạt động gần đây."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      {loading ? <LoadingState /> : null}
      {stats ? (
        <div className="stack">
          <div className="section-grid columns-3">
            <MetricCard label="Người dùng" value={stats.totalUsers} hint={`${stats.activeUsers} hoạt động`} tone="primary" />
            <MetricCard label="Bộ đề" value={stats.totalBanks} hint={`${stats.approvedBanks} đã duyệt`} tone="success" />
            <MetricCard label="Bài thi" value={stats.totalExams} hint={`Điểm TB ${stats.avgScore.toFixed(1)}`} tone="warning" />
          </div>
          <div className="section-grid columns-2">
            <Subsection title="Top người dùng" subtitle="Theo số lượt thi">
              <div className="stack" style={{ minHeight: 320, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topUsers} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="user.fullName" width={120} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <Tooltip cursor={{ fill: "rgba(139, 92, 246, 0.1)" }} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }} />
                    <Bar dataKey="count" fill="var(--primary)" name="Lượt thi" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Subsection>
            <Subsection title="Bài thi gần đây">
              <div className="list scrollable-list">
                {stats.recentExams.map((exam) => (
                  <div key={exam.examId} className="row-card">
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ wordBreak: "break-word", fontWeight: 800 }}>{exam.subjectName || "Bộ đề"}</h3>
                      <p style={{ wordBreak: "break-word", marginTop: "0.25rem", color: "var(--text-secondary)" }}>{exam.bankName}</p>
                      <p style={{ wordBreak: "break-word", marginTop: "0.25rem" }}>{exam.userName}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <strong style={{ color: "var(--primary-hover)" }}>{Math.round(exam.score)}/10</strong>
                      <div className="section-note">{formatDateTime(exam.submittedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Subsection>
          </div>
          <div className="section-grid columns-2">
            <Subsection title="Theo môn học">
              <div className="stack scrollable-list">
                <Table headers={["Môn", "Bộ đề", "Bài thi", "Điểm TB"]}>
                  {subjects.map((row) => (
                    <tr key={row.subjectId}>
                      <td>{row.subjectName}</td>
                      <td>{row.totalBanks}</td>
                      <td>{row.totalExams}</td>
                      <td>{row.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </Subsection>
            <Subsection title="Theo cấp học">
              <div className="stack scrollable-list">
                <Table headers={["Cấp", "Bộ đề", "Bài thi", "Điểm TB"]}>
                  {grades.map((row) => (
                    <tr key={row.gradeId}>
                      <td>{row.gradeName}</td>
                      <td>{row.totalBanks}</td>
                      <td>{row.totalExams}</td>
                      <td>{row.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </Subsection>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN: USERS
   ═══════════════════════════════════════════════ */
function AdminUsersSection({
  token,
  onUserUpdated
}: {
  token: string | null;
  onUserUpdated: (user: AuthUser) => void;
}) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    email: "",
    password: "",
    role: "USER",
    status: "ACTIVE"
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await apiFetch<{ users: AuthUser[] }>(`/admin/users?search=${encodeURIComponent(search)}`, {}, token);
      setUsers(response.data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const edit = (user: AuthUser) => {
    setSelectedId(user.id);
    setForm({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status
    });
  };

  const clear = () => {
    setSelectedId(null);
    setForm({
      username: "",
      fullName: "",
      email: "",
      password: "",
      role: "USER",
      status: "ACTIVE"
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    const body = { ...form };
    if (selectedId) {
      await apiFetch(`/admin/users/${selectedId}`, { method: "PUT", body: JSON.stringify(body) }, token);
    } else {
      await apiFetch(`/admin/users`, { method: "POST", body: JSON.stringify(body) }, token);
    }
    clear();
    await load();
  };

  const remove = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa không?")) return;
    if (!token) return;
    await apiFetch(`/admin/users/${id}`, { method: "DELETE" }, token);
    await load();
  };

  return (
    <div className="split" style={{ alignItems: "start" }}>
      <Section title={selectedId ? "Chỉnh sửa" : "Tạo người dùng"} subtitle="Thông tin tài khoản">
        <form className="stack" onSubmit={submit}>
          <label className="field-group"><span>Tên đăng nhập</span><Input value={form.username} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} disabled={Boolean(selectedId)} /></label>
          <label className="field-group"><span>Họ tên</span><Input value={form.fullName} onChange={(event) => setForm((value) => ({ ...value, fullName: event.target.value }))} /></label>
          <label className="field-group"><span>Email</span><Input value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} /></label>
          <label className="field-group"><span>Mật khẩu {selectedId ? "(để trống = giữ nguyên)" : ""}</span><Input type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></label>
          <div className="form-grid form-columns-2">
            <label className="field-group"><span>Vai trò</span><Select value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></Select></label>
            <label className="field-group"><span>Trạng thái</span><Select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}><option value="ACTIVE">ACTIVE</option><option value="LOCKED">LOCKED</option></Select></label>
          </div>
          <Button type="submit" size="sm">
            <Save size={14} />
            <span>{selectedId ? "Cập nhật" : "Tạo"}</span>
          </Button>
        </form>
      </Section>

      <Section
        title="Quản lý người dùng"
        subtitle="Danh sách tài khoản trong hệ thống."
        actions={
          <Button variant="secondary" size="sm" onClick={clear}>
            <Plus size={14} />
            <span>Tạo mới</span>
          </Button>
        }
      >
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }} style={{ marginBottom: "0.75rem", gap: "0.35rem" }}>
          <Input placeholder="Tìm tên, username, email..." value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 220 }} />
          <Button type="submit" variant="secondary" size="sm"><Search size={13} /></Button>
        </form>
        <div className="stack scrollable-list">
          {loading ? <LoadingState /> : null}
          <Table headers={["Người dùng", "Vai trò", "Trạng thái", ""]}>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.fullName}</strong>
                  <div className="section-note">{user.username} · {user.email}</div>
                </td>
                <td>
                  <Badge tone={user.role === "ADMIN" ? "warning" : "primary"}>{user.role}</Badge>
                </td>
                <td>
                  <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>
                </td>
                <td>
                  <div className="toolbar" style={{ gap: "0.3rem" }}>
                    <Button variant="secondary" size="sm" onClick={() => edit(user)}><Edit3 size={13} /></Button>
                    <Button variant="danger" size="sm" onClick={() => remove(user.id)}><Trash2 size={13} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {!users.length ? <EmptyState title="Chưa có người dùng" /> : null}
        </div>
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN: CATALOG
   ═══════════════════════════════════════════════ */
function AdminCatalogSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: ReturnType<typeof useCatalog>;
}) {
  const [gradeName, setGradeName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const saveGrade = async () => {
    if (!token || !gradeName.trim()) return;
    await apiFetch("/meta/admin/grades", { method: "POST", body: JSON.stringify({ name: gradeName }) }, token);
    setGradeName("");
    await catalog.refresh();
    setMessage("Đã thêm cấp học.");
  };

  const saveSubject = async () => {
    if (!token || !subjectName.trim()) return;
    await apiFetch("/meta/admin/subjects", { method: "POST", body: JSON.stringify({ name: subjectName }) }, token);
    setSubjectName("");
    await catalog.refresh();
    setMessage("Đã thêm môn học.");
  };

  const removeGrade = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa không?")) return;
    if (!token) return;
    await apiFetch(`/meta/admin/grades/${id}`, { method: "DELETE" }, token);
    await catalog.refresh();
  };

  const removeSubject = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa không?")) return;
    if (!token) return;
    await apiFetch(`/meta/admin/subjects/${id}`, { method: "DELETE" }, token);
    await catalog.refresh();
  };

  return (
    <Section title="Môn học và cấp học" subtitle="Danh mục dùng chung cho bộ đề, thống kê và bộ lọc.">
      <div className="section-grid columns-2">
        <Subsection title="Cấp học" actions={<Button size="sm" onClick={saveGrade}><Plus size={14} /><span>Thêm</span></Button>}>
          <div className="form-grid scrollable-list">
            <Input value={gradeName} onChange={(event) => setGradeName(event.target.value)} placeholder="Ví dụ: Lớp 10" />
            <Table headers={["Cấp học", ""]}>
              {catalog.grades.map((grade) => (
                <tr key={grade.id}>
                  <td>{grade.name}</td>
                  <td style={{ width: 50 }}><Button variant="danger" size="sm" onClick={() => removeGrade(grade.id)}><Trash2 size={13} /></Button></td>
                </tr>
              ))}
            </Table>
          </div>
        </Subsection>
        <Subsection title="Môn học" actions={<Button size="sm" onClick={saveSubject}><Plus size={14} /><span>Thêm</span></Button>}>
          <div className="form-grid scrollable-list">
            <Input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Ví dụ: Toán" />
            <Table headers={["Môn học", ""]}>
              {catalog.subjects.map((subject) => (
                <tr key={subject.id}>
                  <td>{subject.name}</td>
                  <td style={{ width: 50 }}><Button variant="danger" size="sm" onClick={() => removeSubject(subject.id)}><Trash2 size={13} /></Button></td>
                </tr>
              ))}
            </Table>
          </div>
        </Subsection>
      </div>
      {message ? <div className="form-success" style={{ marginTop: "1rem" }}>{message}</div> : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN: BANKS
   ═══════════════════════════════════════════════ */
function AdminBanksSection({
  token,
  catalog
}: {
  token: string | null;
  catalog: ReturnType<typeof useCatalog>;
}) {
  const [banks, setBanks] = useState<BankSummary[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankSummary | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({ search: "", gradeId: "", subjectId: "", status: "" });
  const [insightReport, setInsightReport] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: "",
    description: "",
    gradeId: "",
    subjectId: "",
    isPublic: false,
    defaultQuestionCount: "20",
    defaultDurationMinutes: "20"
  });
  const [questionForm, setQuestionForm] = useState({
    content: "",
    difficulty: "TB",
    answers: [
      { content: "", isCorrect: false },
      { content: "", isCorrect: true },
      { content: "", isCorrect: false },
      { content: "", isCorrect: false }
    ] as Array<{ content: string; isCorrect: boolean }>
  });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  const loadBanks = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.gradeId) params.set("gradeId", filters.gradeId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.status) params.set("status", filters.status);
      const response = await apiFetch<{ banks: BankSummary[] }>(`/admin/banks?${params.toString()}`, {}, token);
      setBanks(response.data.banks);
      if (!selectedBank && response.data.banks[0]) {
        setSelectedBank(response.data.banks[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (bankId: number) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const [bank, qs] = await Promise.all([
        apiFetch<{ bank: BankSummary }>(`/admin/banks/${bankId}`, {}, token),
        apiFetch<{ questions: Question[] }>(`/admin/banks/${bankId}/questions`, {}, token)
      ]);
      setSelectedBank(bank.data.bank);
      setQuestions(qs.data.questions);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadBanks();
  }, [token]);

  useEffect(() => {
    if (selectedBank) {
      setInsightReport(null);
      void loadDetail(selectedBank.id);
    }
  }, [selectedBank?.id]);

  const generateInsight = async () => {
    if (!token || !selectedBank) return;
    setInsightLoading(true);
    setInsightReport(null);
    try {
      const response = await apiFetch<{ report: string }>(`/admin/banks/${selectedBank.id}/insights`, {}, token);
      setInsightReport(response.data.report);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Có lỗi xảy ra khi tạo báo cáo.");
    } finally {
      setInsightLoading(false);
    }
  };

  const createBank = async () => {
    if (!token) return;
    await apiFetch("/admin/banks", {
      method: "POST",
      body: JSON.stringify({
        name: bankForm.name,
        description: bankForm.description,
        gradeId: Number(bankForm.gradeId),
        subjectId: Number(bankForm.subjectId),
        isPublic: bankForm.isPublic,
        defaultQuestionCount: Number(bankForm.defaultQuestionCount),
        defaultDurationMinutes: Number(bankForm.defaultDurationMinutes)
      })
    }, token);
    setBankForm({
      name: "",
      description: "",
      gradeId: "",
      subjectId: "",
      isPublic: false,
      defaultQuestionCount: "20",
      defaultDurationMinutes: "20"
    });
    await loadBanks();
  };

  const saveBank = async () => {
    if (!token || !selectedBank) return;
    await apiFetch(`/admin/banks/${selectedBank.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: selectedBank.name,
        description: selectedBank.description,
        gradeId: selectedBank.grade?.id,
        subjectId: selectedBank.subject?.id,
        isPublic: selectedBank.isPublic,
        status: selectedBank.status,
        defaultQuestionCount: selectedBank.defaultQuestionCount,
        defaultDurationMinutes: selectedBank.defaultDurationMinutes
      })
    }, token);
    await loadBanks();
  };

  const approveBank = async (status: string) => {
    if (!token || !selectedBank) return;
    await apiFetch(`/admin/banks/${selectedBank.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }, token);
    await loadBanks();
    await loadDetail(selectedBank.id);
  };

  const togglePublic = async (value: boolean) => {
    if (!token || !selectedBank) return;
    await apiFetch(`/admin/banks/${selectedBank.id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic: value })
    }, token);
    await loadBanks();
    await loadDetail(selectedBank.id);
  };

  const removeBank = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa không?")) return;
    if (!token || !selectedBank) return;
    await apiFetch(`/admin/banks/${selectedBank.id}`, { method: "DELETE" }, token);
    setSelectedBank(null);
    setQuestions([]);
    await loadBanks();
  };

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    const answers = question.answers.length
      ? question.answers.map((answer) => ({
          content: answer.content,
          isCorrect: Boolean(answer.isCorrect)
        }))
      : [
          { content: "", isCorrect: false },
          { content: "", isCorrect: true },
          { content: "", isCorrect: false },
          { content: "", isCorrect: false }
        ];
    if (!answers.some((answer) => answer.isCorrect) && answers[0]) {
      answers[0].isCorrect = true;
    }
    setQuestionForm({
      content: question.content,
      difficulty: question.difficulty,
      answers
    });
  };

  const clearQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      content: "",
      difficulty: "TB",
      answers: [
        { content: "", isCorrect: false },
        { content: "", isCorrect: true },
        { content: "", isCorrect: false },
        { content: "", isCorrect: false }
      ]
    });
  };

  const saveQuestion = async () => {
    if (!token || !selectedBank) return;
    const body = {
      content: questionForm.content,
      difficulty: questionForm.difficulty,
      answers: questionForm.answers
    };
    if (editingQuestionId) {
      await apiFetch(`/admin/questions/${editingQuestionId}`, { method: "PUT", body: JSON.stringify(body) }, token);
    } else {
      await apiFetch(`/admin/banks/${selectedBank.id}/questions`, { method: "POST", body: JSON.stringify(body) }, token);
    }
    clearQuestionForm();
    await loadDetail(selectedBank.id);
    await loadBanks();
  };

  const deleteQuestion = async (questionId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa không?")) return;
    if (!token) return;
    await apiFetch(`/admin/questions/${questionId}`, { method: "DELETE" }, token);
    if (selectedBank) {
      await loadDetail(selectedBank.id);
    }
    await loadBanks();
  };

  return (
    <div className="split" style={{ alignItems: "start" }}>
      <div className="stack">
        {/* Create bank */}
        <Section title="Tạo bộ đề mới" subtitle="Nhập thông tin cơ bản">
          <div className="stack">
            <div className="form-grid">
              <Input placeholder="Tên bộ đề" value={bankForm.name} onChange={(event) => setBankForm((value) => ({ ...value, name: event.target.value }))} />
              <Input placeholder="Mô tả" value={bankForm.description} onChange={(event) => setBankForm((value) => ({ ...value, description: event.target.value }))} />
              <div className="form-grid form-columns-2">
                <Select value={bankForm.gradeId} onChange={(event) => setBankForm((value) => ({ ...value, gradeId: event.target.value }))}>
                  <option value="">Cấp học</option>
                  {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </Select>
                <Select value={bankForm.subjectId} onChange={(event) => setBankForm((value) => ({ ...value, subjectId: event.target.value }))}>
                  <option value="">Môn học</option>
                  {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </Select>
              </div>
              <div className="form-grid form-columns-2">
                <Input value={bankForm.defaultQuestionCount} onChange={(event) => setBankForm((value) => ({ ...value, defaultQuestionCount: event.target.value }))} placeholder="Số câu" />
                <Input value={bankForm.defaultDurationMinutes} onChange={(event) => setBankForm((value) => ({ ...value, defaultDurationMinutes: event.target.value }))} placeholder="Phút" />
              </div>
              <Toggle checked={bankForm.isPublic} onChange={(checked) => setBankForm((value) => ({ ...value, isPublic: checked }))} label="Công khai" />
              <Button size="sm" onClick={createBank}>
                <Plus size={14} />
                <span>Tạo</span>
              </Button>
            </div>
          </div>
        </Section>

        {/* Bank list */}
        <Section
          title="Danh sách bộ đề"
          subtitle="Chọn để chỉnh sửa bên phải"
          actions={
            <Button variant="secondary" size="sm" onClick={() => void loadBanks()}>
              <RefreshCcw size={14} />
              <span>Tải lại</span>
            </Button>
          }
        >
          <form className="toolbar" onSubmit={(e) => { e.preventDefault(); loadBanks(); }} style={{ gap: "0.35rem" }}>
            <Input placeholder="Tìm..." value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))} style={{ maxWidth: 140 }} />
            <Select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))} style={{ maxWidth: 130 }}>
              <option value="">Trạng thái</option>
              <option value="CHO_DUYET">Chờ duyệt</option>
              <option value="DA_DUYET">Đã duyệt</option>
              <option value="TU_CHOI">Từ chối</option>
            </Select>
            <Button type="submit" variant="secondary" size="sm"><Search size={13} /></Button>
          </form>
          {loading ? <LoadingState /> : null}
          <div className="list scrollable-list" style={{ marginTop: "0.5rem" }}>
            {banks.map((bank) => (
              <button
                key={bank.id}
                type="button"
                className="row-card"
                onClick={() => setSelectedBank(bank)}
                style={{
                  textAlign: "left",
                  borderColor: selectedBank?.id === bank.id ? "rgba(139,92,246,0.3)" : undefined,
                  background: selectedBank?.id === bank.id ? "var(--primary-muted)" : undefined
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ wordBreak: "break-word", fontWeight: 800 }}>{bank.subject?.name || "Bộ đề"}</h3>
                  <p style={{ wordBreak: "break-word", marginTop: "0.25rem", color: "var(--text-secondary)" }}>{bank.name}</p>
                  <div className="toolbar" style={{ marginTop: "0.5rem", gap: "0.25rem" }}>
                    <Badge tone={bank.isPublic ? "success" : "warning"}>{bank.isPublic ? "Công khai" : "Riêng"}</Badge>
                    <Badge tone={statusTone(bank.status)}>{statusLabel(bank.status)}</Badge>
                    <Badge tone="neutral">{bank.grade?.name}</Badge>
                    <Badge tone="neutral">{bank._count?.questions || 0} câu</Badge>
                    <Badge tone="primary">{bank._count?.exams || 0} lượt thi</Badge>
                  </div>
                  <div className="section-note" style={{ marginTop: "0.4rem" }}>
                    Tạo bởi {bank.creator?.fullName || "N/A"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Bank detail */}
      <div className="stack">
        <Section title="Chi tiết bộ đề" subtitle={selectedBank ? selectedBank.name : "Chưa chọn"}>
          {detailLoading ? <LoadingState /> : null}
          {selectedBank ? (
            <div className="stack">
              <div className="toolbar" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                <Input value={selectedBank.name} onChange={(event) => setSelectedBank((value) => value ? ({ ...value, name: event.target.value }) : value)} style={{ maxWidth: 200 }} />
                <Button variant="secondary" size="sm" onClick={saveBank}><Save size={13} /><span>Lưu</span></Button>
                <Button variant="secondary" size="sm" onClick={() => approveBank("DA_DUYET")}><CheckCircle2 size={13} /><span>Duyệt</span></Button>
                <Button variant="secondary" size="sm" onClick={() => togglePublic(!selectedBank.isPublic)}><ShieldCheck size={13} /><span>{selectedBank.isPublic ? "Ẩn" : "Công khai"}</span></Button>
                <Button variant="danger" size="sm" onClick={removeBank}><Trash2 size={13} /></Button>
                <div style={{ marginLeft: "auto" }}>
                  <Button variant="primary" size="sm" onClick={generateInsight} disabled={insightLoading}>
                    {insightLoading ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />}
                    <span>AI Phân tích</span>
                  </Button>
                </div>
              </div>
              <div className="form-grid form-columns-2">
                <label className="field-group"><span>Mô tả</span><Textarea value={selectedBank.description || ""} onChange={(event) => setSelectedBank((value) => value ? ({ ...value, description: event.target.value }) : value)} /></label>
                <div className="stack">
                  <label className="field-group">
                    <span>Cấp học</span>
                    <Select
                      value={selectedBank.grade?.id || ""}
                      onChange={(event) =>
                        setSelectedBank((value) => {
                          if (!value || !event.target.value) return value;
                          const nextId = Number(event.target.value);
                          return {
                            ...value,
                            grade: {
                              id: nextId,
                              name: catalog.grades.find((grade) => grade.id === nextId)?.name || value.grade.name
                            }
                          };
                        })
                      }
                    >
                      <option value="">Chọn</option>
                      {catalog.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                    </Select>
                  </label>
                  <label className="field-group">
                    <span>Môn học</span>
                    <Select
                      value={selectedBank.subject?.id || ""}
                      onChange={(event) =>
                        setSelectedBank((value) => {
                          if (!value || !event.target.value) return value;
                          const nextId = Number(event.target.value);
                          return {
                            ...value,
                            subject: {
                              id: nextId,
                              name: catalog.subjects.find((subject) => subject.id === nextId)?.name || value.subject.name
                            }
                          };
                        })
                      }
                    >
                      <option value="">Chọn</option>
                      {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                    </Select>
                  </label>
                </div>
                <label className="field-group"><span>Số câu mặc định</span><Input value={selectedBank.defaultQuestionCount ?? ""} onChange={(event) => setSelectedBank((value) => value ? ({ ...value, defaultQuestionCount: Number(event.target.value) || null }) : value)} /></label>
                <label className="field-group"><span>Thời gian mặc định</span><Input value={selectedBank.defaultDurationMinutes ?? ""} onChange={(event) => setSelectedBank((value) => value ? ({ ...value, defaultDurationMinutes: Number(event.target.value) || null }) : value)} /></label>
              </div>
              <div className="toolbar" style={{ gap: "0.35rem" }}>
                <Button variant="secondary" size="sm" onClick={() => void downloadFile(token, `/admin/banks/${selectedBank.id}/export/docx`, `${selectedBank.name}.docx`)}>
                  <FileDown size={13} />
                  <span>Word</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void downloadFile(token, `/admin/banks/${selectedBank.id}/export/xlsx`, `${selectedBank.name}.xlsx`)}>
                  <Download size={13} />
                  <span>Excel</span>
                </Button>
              </div>

              {/* AI Insight Report */}
              {insightReport || insightLoading ? (
                <div style={{ background: "rgba(139, 92, 246, 0.05)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "var(--radius)", padding: "1.5rem", marginTop: "1rem" }}>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", marginBottom: "1rem" }}>
                    <Sparkles size={18} /> Báo cáo Phân tích bằng AI
                  </h3>
                  {insightLoading ? (
                    <LoadingState label="AI đang phân tích dữ liệu làm bài..." />
                  ) : (
                    <div className="markdown-body" style={{ fontSize: "0.95rem", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: insightReport?.replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") || "" }} />
                  )}
                </div>
              ) : null}

              {/* Questions */}
              <div className="question-list scrollable-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="question-card">
                    <div className="toolbar" style={{ justifyContent: "space-between" }}>
                      <div className="toolbar" style={{ gap: "0.25rem" }}>
                        <Badge tone="primary">Câu {index + 1}</Badge>
                        <Badge tone="neutral">{question.difficulty}</Badge>
                      </div>
                      <div className="toolbar" style={{ gap: "0.25rem" }}>
                        <Button variant="secondary" size="sm" onClick={() => editQuestion(question)}><PencilLine size={13} /></Button>
                        <Button variant="danger" size="sm" onClick={() => deleteQuestion(question.id)}><Trash2 size={13} /></Button>
                      </div>
                    </div>
                    <h4>{question.content}</h4>
                    <div className="question-options">
                      {question.answers.map((answer, answerIndex) => (
                        <div key={answer.id} className={`question-option ${answer.isCorrect ? "question-option-correct" : ""}`}>
                          <strong>{String.fromCharCode(65 + answerIndex)}</strong>
                          <span style={{ flex: 1 }}>{answer.content}</span>
                          {answer.isCorrect ? <Badge tone="success">✓</Badge> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Question form */}
              <Subsection
                title={editingQuestionId ? "Sửa câu hỏi" : "Thêm câu hỏi"}
                subtitle="Trắc nghiệm 4 lựa chọn, 1 đáp án đúng."
                actions={editingQuestionId ? <Button variant="ghost" size="sm" onClick={clearQuestionForm}><X size={13} /><span>Hủy</span></Button> : null}
              >
                <div className="stack">
                  <label className="field-group"><span>Nội dung</span><Textarea value={questionForm.content} onChange={(event) => setQuestionForm((value) => ({ ...value, content: event.target.value }))} /></label>
                  <label className="field-group"><span>Mức độ</span><Select value={questionForm.difficulty} onChange={(event) => setQuestionForm((value) => ({ ...value, difficulty: event.target.value }))}><option value="DE">Dễ</option><option value="TB">Trung bình</option><option value="KHO">Khó</option></Select></label>
                  <div className="question-options">
                    {questionForm.answers.map((answer, idx) => (
                      <div key={idx} className="question-option" style={{ alignItems: "center" }}>
                        <strong>{String.fromCharCode(65 + idx)}</strong>
                        <Input value={answer.content} onChange={(event) => setQuestionForm((value) => ({ ...value, answers: value.answers.map((item, index) => index === idx ? { ...item, content: event.target.value } : item) }))} style={{ flex: 1 }} />
                        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: answer.isCorrect ? "var(--success)" : "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                          <input type="radio" name="correct-answer" checked={answer.isCorrect} onChange={() => setQuestionForm((value) => ({ ...value, answers: value.answers.map((item, index) => ({ ...item, isCorrect: index === idx })) }))} style={{ accentColor: "var(--success)" }} />
                          Đúng
                        </label>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={saveQuestion}>
                    <SaveAll size={14} />
                    <span>{editingQuestionId ? "Lưu câu hỏi" : "Thêm câu hỏi"}</span>
                  </Button>
                </div>
              </Subsection>
            </div>
          ) : (
            <EmptyState title="Chọn một bộ đề để chỉnh sửa" />
          )}
        </Section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN: STATS
   ═══════════════════════════════════════════════ */
function AdminStatsSection({ token }: { token: string | null }) {
  const [stats, setStats] = useState<AdminStatsOverview | null>(null);
  const [subjects, setSubjects] = useState<AdminSubjectRow[]>([]);
  const [grades, setGrades] = useState<AdminGradeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overview, bySubject, byGrade] = await Promise.all([
        apiFetch<AdminStatsOverview>("/admin/stats/overview", {}, token),
        apiFetch<{ rows: AdminSubjectRow[] }>("/admin/stats/by-subject", {}, token),
        apiFetch<{ rows: AdminGradeRow[] }>("/admin/stats/by-grade", {}, token)
      ]);
      setStats(overview.data);
      setSubjects(bySubject.data.rows);
      setGrades(byGrade.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <Section
      title="Thống kê chi tiết"
      subtitle="Bức tranh toàn cảnh về lượt thi, điểm số và hiệu suất."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      {loading ? <LoadingState /> : null}
      {stats ? (
        <div className="stack">
          <div className="section-grid columns-3">
            <MetricCard label="Tổng người dùng" value={stats.totalUsers} hint={`${stats.activeUsers} hoạt động`} tone="primary" />
            <MetricCard label="Chờ duyệt" value={stats.pendingBanks} hint={`${stats.approvedBanks} đã duyệt`} tone="warning" />
            <MetricCard label="Điểm trung bình" value={stats.avgScore.toFixed(1)} hint={`${stats.totalExams} bài thi`} tone="success" />
          </div>
          <div className="section-grid columns-2">
            <Subsection title="Theo môn học" subtitle="Lượt thi & Điểm TB">
              <div className="stack" style={{ minHeight: 320, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={subjects} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis dataKey="subjectName" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <Tooltip contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }} />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    <Bar yAxisId="left" dataKey="totalExams" name="Lượt thi" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Điểm TB" stroke="var(--warning)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Subsection>
            <Subsection title="Theo cấp học" subtitle="Tỉ trọng lượt thi">
              <div className="stack" style={{ minHeight: 320, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={grades}
                      dataKey="totalExams"
                      nameKey="gradeName"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {grades.map((_, index) => {
                        const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Subsection>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN EXAMS SECTION
   ═══════════════════════════════════════════════ */
type AdminExamRow = {
  id: number;
  userId: number;
  userName: string;
  username: string;
  bankId: number;
  bankName: string;
  score: number | null;
  totalQuestions: number | null;
  correctCount: number | null;
  submittedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
};

type AdminExamDetail = AdminExamRow & {
  items: Array<{
    index: number;
    questionId: number;
    questionContent: string;
    answers: Array<{ id: number; content: string; isCorrect: boolean }>;
    selectedAnswerId: number | null;
    selectedAnswerContent: string | null;
    correctAnswerContent: string | null;
    isCorrect: boolean | null;
  }>;
};

function formatDur(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function AdminExamsSection({ token }: { token: string | null }) {
  const [exams, setExams] = useState<AdminExamRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminExamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (pg = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = await apiFetch<{ exams: AdminExamRow[]; total: number; totalPages: number }>(`/admin/exams?${params.toString()}`, {}, token);
      setExams(res.data.exams);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(pg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [token]);

  const openDetail = async (id: number) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const res = await apiFetch<{ exam: AdminExamDetail }>(`/admin/exams/${id}`, {}, token);
      setDetail(res.data.exam);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải chi tiết.");
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteExam = async (id: number) => {
    if (!token || !confirm("Xóa bài thi này?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/exams/${id}`, { method: "DELETE" }, token);
      setExams(prev => prev.filter(e => e.id !== id));
      setTotal(prev => prev - 1);
      if (detail?.id === id) setDetail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại.");
    } finally {
      setDeleting(null);
    }
  };

  const scoreColor = (score: number | null) => {
    if (score === null) return "var(--text-tertiary)";
    if (score >= 8) return "var(--success)";
    if (score >= 5) return "var(--warning)";
    return "var(--danger)";
  };

  return (
    <>
      {/* ── Modal chi tiết bài thi ── */}
      {detail && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "1.5rem", width: "100%", maxWidth: 720, position: "relative" }}>
            <button onClick={() => setDetail(null)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>

            {/* Header */}
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Chi tiết bài thi #{detail.id}</h3>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>👤 <strong>{detail.userName}</strong> (@{detail.username})</span>
                <span>📚 {detail.bankName}</span>
                <span>⏱ {formatDur(detail.durationSeconds)}</span>
                <span style={{ color: scoreColor(detail.score), fontWeight: 700 }}>
                  Điểm: {detail.score !== null ? `${Math.round(detail.score)}/10` : "—"}
                </span>
                <span>✅ {detail.correctCount}/{detail.totalQuestions} câu đúng</span>
              </div>
            </div>

            {/* Câu hỏi */}
            <div className="stack" style={{ gap: "0.75rem", maxHeight: "65vh", overflowY: "auto", paddingRight: "0.25rem" }}>
              {detail.items.map(item => (
                <div key={item.questionId} className="question-card" style={{ padding: "1rem" }}>
                  <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
                    <Badge tone={item.isCorrect ? "success" : "danger"}>{item.isCorrect ? "✓ Đúng" : "✗ Sai"}</Badge>
                    <Badge tone="neutral">Câu {item.index}</Badge>
                  </div>
                  <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.5 }}>{item.questionContent}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {item.answers.map(ans => {
                      const isSelected = ans.id === item.selectedAnswerId;
                      const isCorrect = ans.isCorrect;
                      let bg = "transparent";
                      let color = "var(--text-secondary)";
                      if (isCorrect) { bg = "rgba(16,185,129,0.12)"; color = "var(--success)"; }
                      if (isSelected && !isCorrect) { bg = "rgba(239,68,68,0.12)"; color = "var(--danger)"; }
                      return (
                        <div key={ans.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.6rem", borderRadius: "var(--radius-md)", background: bg, fontSize: "0.85rem" }}>
                          <span style={{ color, fontWeight: isSelected || isCorrect ? 700 : 400 }}>
                            {isSelected && !isCorrect ? "✗" : isCorrect ? "✓" : "○"}
                          </span>
                          <span style={{ color }}>{ans.content}</span>
                          {isSelected && <Badge tone={isCorrect ? "success" : "danger"} style={{ marginLeft: "auto", fontSize: "0.7rem" }}>Đã chọn</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Section
        title="Quản lý bài thi"
        subtitle={`Tổng: ${total} bài thi`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load(1)} disabled={loading}>
            <RefreshCcw size={14} />
            <span>Tải lại</span>
          </Button>
        }
      >
        {/* Bộ lọc */}
        <div className="toolbar" style={{ marginBottom: "0.75rem", gap: "0.5rem", flexWrap: "wrap" }}>
          <Input
            placeholder="Tìm theo họ tên, tên bộ đề..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && void load(1)}
            style={{ maxWidth: 260 }}
          />
          <Select value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">Tất cả</option>
            <option value="submitted">Đã nộp</option>
            <option value="ongoing">Đang thi</option>
          </Select>
          <Button size="sm" onClick={() => void load(1)} disabled={loading}>
            <Search size={14} />
            <span>Lọc</span>
          </Button>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
        {(loading || detailLoading) ? <LoadingState /> : null}

        <div className="stack scrollable-list">
          <Table headers={["ID", "Học viên", "Bộ đề", "Điểm", "Kết quả", "Thời gian", "Trạng thái", "Ngày thi", ""]}>
            {exams.map(exam => (
              <tr key={exam.id} style={{ cursor: "pointer" }} onClick={() => void openDetail(exam.id)}>
                <td style={{ opacity: 0.5, fontSize: "0.8rem" }}>#{exam.id}</td>
                <td>
                  <strong style={{ fontSize: "0.85rem" }}>{exam.userName}</strong>
                  <div className="section-note">@{exam.username}</div>
                </td>
                <td style={{ fontSize: "0.85rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {exam.bankName}
                </td>
                <td>
                  <strong style={{ color: scoreColor(exam.score) }}>
                    {exam.score !== null ? `${Math.round(exam.score)}/10` : <span style={{ opacity: 0.4 }}>—</span>}
                  </strong>
                </td>
                <td style={{ fontSize: "0.85rem" }}>
                  {exam.correctCount !== null && exam.totalQuestions
                    ? `${exam.correctCount}/${exam.totalQuestions}`
                    : <span style={{ opacity: 0.4 }}>—</span>}
                </td>
                <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{formatDur(exam.durationSeconds)}</td>
                <td>
                  <Badge tone={exam.submittedAt ? "success" : "warning"}>
                    {exam.submittedAt ? "Đã nộp" : "Đang thi"}
                  </Badge>
                </td>
                <td style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                  {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteExam(exam.id)}
                    disabled={deleting === exam.id}
                    style={{ color: "var(--danger)" }}
                  >
                    {deleting === exam.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="toolbar" style={{ justifyContent: "center", marginTop: "1rem", gap: "0.5rem" }}>
            <Button variant="secondary" size="sm" onClick={() => void load(page - 1)} disabled={page <= 1 || loading}>
              ‹ Trước
            </Button>
            <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Trang {page}/{totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}>
              Tiếp ›
            </Button>
          </div>
        )}

        {!loading && !exams.length ? (
          <EmptyState title="Không có bài thi nào" description="Thử thay đổi bộ lọc." />
        ) : null}
      </Section>
    </>
  );
}

  const [exams, setExams] = useState<AdminExamRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async (pg = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = await apiFetch<{ exams: AdminExamRow[]; total: number; totalPages: number }>(`/admin/exams?${params.toString()}`, {}, token);
      setExams(res.data.exams);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(pg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [token]);

  const deleteExam = async (id: number) => {
    if (!token || !confirm("Xóa bài thi này?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/exams/${id}`, { method: "DELETE" }, token);
      setExams(prev => prev.filter(e => e.id !== id));
      setTotal(prev => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại.");
    } finally {
      setDeleting(null);
    }
  };

  const scoreColor = (score: number | null) => {
    if (score === null) return "var(--text-tertiary)";
    if (score >= 8) return "var(--success)";
    if (score >= 5) return "var(--warning)";
    return "var(--danger)";
  };

  return (
    <Section
      title="Quản lý bài thi"
      subtitle={`Tổng: ${total} bài thi`}
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load(1)} disabled={loading}>
          <RefreshCcw size={14} />
          <span>Tải lại</span>
        </Button>
      }
    >
      {/* Bộ lọc */}
      <div className="toolbar" style={{ marginBottom: "0.75rem", gap: "0.5rem", flexWrap: "wrap" }}>
        <Input
          placeholder="Tìm theo họ tên, tên bộ đề..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && void load(1)}
          style={{ maxWidth: 260 }}
        />
        <Select value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Tất cả</option>
          <option value="submitted">Đã nộp</option>
          <option value="ongoing">Đang thi</option>
        </Select>
        <Button size="sm" onClick={() => void load(1)} disabled={loading}>
          <Search size={14} />
          <span>Lọc</span>
        </Button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <LoadingState /> : null}

      <div className="stack scrollable-list">
        <Table headers={["ID", "Học viên", "Bộ đề", "Điểm", "Kết quả", "Trạng thái", "Ngày thi", ""]}>
          {exams.map(exam => (
            <tr key={exam.id}>
              <td style={{ opacity: 0.5, fontSize: "0.8rem" }}>#{exam.id}</td>
              <td>
                <strong style={{ fontSize: "0.85rem" }}>{exam.userName}</strong>
                <div className="section-note">@{exam.username}</div>
              </td>
              <td style={{ fontSize: "0.85rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {exam.bankName}
              </td>
              <td>
                <strong style={{ color: scoreColor(exam.score), fontSize: "1rem" }}>
                  {exam.score !== null ? `${Math.round(exam.score)}/10` : <span style={{ opacity: 0.4 }}>—</span>}
                </strong>
              </td>
              <td style={{ fontSize: "0.85rem" }}>
                {exam.correctCount !== null && exam.totalQuestions
                  ? `${exam.correctCount}/${exam.totalQuestions}`
                  : <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td>
                <Badge tone={exam.submittedAt ? "success" : "warning"}>
                  {exam.submittedAt ? "Đã nộp" : "Đang thi"}
                </Badge>
              </td>
              <td style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
              </td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteExam(exam.id)}
                  disabled={deleting === exam.id}
                  style={{ color: "var(--danger)" }}
                >
                  {deleting === exam.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="toolbar" style={{ justifyContent: "center", marginTop: "1rem", gap: "0.5rem" }}>
          <Button variant="secondary" size="sm" onClick={() => void load(page - 1)} disabled={page <= 1 || loading}>
            ‹ Trước
          </Button>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Trang {page}/{totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}>
            Tiếp ›
          </Button>
        </div>
      )}

      {!loading && !exams.length ? (
        <EmptyState title="Không có bài thi nào" description="Thử thay đổi bộ lọc." />
      ) : null}
    </Section>
  );
}
