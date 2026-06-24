import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, ChevronLeft, ChevronRight, Clock3, TimerReset, ShieldCheck, CircleCheckBig, LoaderCircle, ArrowLeft, Trophy, Target, Timer, Volume2, Square } from "lucide-react";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import confetti from "canvas-confetti";
import { playTing, playTickTock, playWin, speakText, stopSpeaking } from "@/utils/audio";
import { Badge, Button, EmptyState, Input, LoadingState, Section, Subsection } from "@/components/common";
import { CommentSection } from "@/components/CommentSection";
import type { BankSummary, ExamQuestion, ExamSession, Grade, Subject } from "@/types";

type ExamResult = {
  exam: {
    id: number;
    totalQuestions: number;
    correctCount: number;
    score: number;
    submittedAt: string | null;
    durationSeconds: number | null;
  };
  items: Array<{
    id: number;
    questionId: number;
    questionContent: string;
    selectedAnswerId: number | null;
    selectedAnswerContent: string | null;
    correctAnswerContent: string | null;
    isCorrect: boolean | null;
  }>;
};

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function CircularTimer({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const progress = totalSeconds > 0 ? Math.max(0, secondsLeft / totalSeconds) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  return (
    <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto" }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={isUrgent ? "var(--danger)" : "var(--primary)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 300ms ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: isUrgent ? "var(--danger)" : "var(--text)", letterSpacing: "-0.02em" }}>
          {formatDuration(secondsLeft)}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", fontWeight: 600 }}>còn lại</span>
      </div>
    </div>
  );
}

export function ExamPage() {
  const { bankId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bank, setBank] = useState<BankSummary | null>(null);
  const [questionCount, setQuestionCount] = useState("10");
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteState, setFavoriteState] = useState<Record<number, boolean>>({});
  const [isSurvivalMode, setIsSurvivalMode] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(15);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const autoSubmitRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const selectedAnswerId = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((Object.keys(answers).length / questions.length) * 100);
  }, [answers, questions.length]);

  const toggleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      if (!currentQuestion) return;
      setIsSpeaking(true);
      const text = `Câu hỏi: ${currentQuestion.content}. ` + currentQuestion.answers.map((a, i) => `Đáp án ${String.fromCharCode(65 + i)}: ${a.content}`).join(". ");
      speakText(text, () => setIsSpeaking(false));
    }
  };

  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const loadBank = async () => {
    if (!token || !bankId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ bank: BankSummary }>(`/banks/${bankId}`, {}, token);
      setBank(response.data.bank);
      setQuestionCount(String(response.data.bank.defaultQuestionCount || response.data.bank._count?.questions || 10));
      setDurationMinutes(String(response.data.bank.defaultDurationMinutes || 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải bộ đề.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBank();
  }, [bankId, token]);

  useEffect(() => {
    if (!session) return;
    autoSubmitRef.current = false;
    setTotalDuration(session.durationSeconds);
    const deadline = new Date(session.startedAt).getTime() + session.durationSeconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submitExam();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Survival Mode per-question timer
  useEffect(() => {
    if (!session || !isSurvivalMode || result) return;
    setQuestionTimeLeft(15);
    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          setCurrentIndex((curr) => {
            if (curr >= questions.length - 1) {
              if (!autoSubmitRef.current) {
                autoSubmitRef.current = true;
                void submitExam();
              }
              return curr;
            }
            return curr + 1;
          });
          return 15;
        }
        
        if (prev > 1 && prev <= 6) {
          playTickTock();
        }
        
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session, isSurvivalMode, currentIndex, questions.length, result]);

  const startExam = async () => {
    if (!token || !bankId) return;
    setStarting(true);
    setError(null);
    try {
      const response = await apiFetch<{ exam: ExamSession; bank: BankSummary; questions: ExamQuestion[] }>("/exams/start", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(bankId),
          questionCount: bank?.isPublic ? Number(questionCount) : undefined,
          durationMinutes: bank?.isPublic 
            ? (isSurvivalMode ? Math.ceil((Number(questionCount) * 15) / 60) : Number(durationMinutes))
            : undefined,
          isReviewMode
        })
      }, token);
      setSession(response.data.exam);
      setQuestions(response.data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSecondsLeft(response.data.exam.durationSeconds);
      setTotalDuration(response.data.exam.durationSeconds);
      setFavoriteState({});
      autoSubmitRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể bắt đầu bài thi.");
    } finally {
      setStarting(false);
    }
  };

  const submitExam = async () => {
    if (!token || !session || submitting || result) return;
    autoSubmitRef.current = true;
    setSubmitting(true);
    try {
      const response = await apiFetch<ExamResult>(`/exams/${session.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            answerId: answers[question.id] ?? null
          }))
        })
      }, token);
      setResult(response.data);
      setSession(null);
      
      const percent = (response.data.exam.correctCount / response.data.exam.totalQuestions) * 100;
      if (percent >= 80) {
        playWin();
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nộp bài.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFavorite = async () => {
    if (!token || !currentQuestion) return;
    try {
      const response = await apiFetch<{ favorited: boolean }>(`/favorites/${currentQuestion.id}`, { method: "POST" }, token);
      setFavoriteState((value) => ({
        ...value,
        [currentQuestion.id]: response.data.favorited
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật yêu thích.");
    }
  };

  if (loading) {
    return <div className="app-loader"><LoadingState label="Đang tải bộ đề..." /></div>;
  }

  if (error && !bank) {
    return (
      <div className="app-loader" style={{ padding: "1.5rem" }}>
        <Section title="Không thể mở bài thi" subtitle={error} actions={<Button variant="secondary" onClick={() => navigate("/app")}><ArrowLeft size={15} /><span>Quay lại</span></Button>}>
          <EmptyState title="Có lỗi xảy ra" description={error} />
        </Section>
      </div>
    );
  }

  // Result view
  if (result) {
    const scorePercent = result.exam.score * 10; // score 0-10 → percent 0-100 cho vòng tròn
    const scoreColor = result.exam.score >= 8 ? "var(--success)" : result.exam.score >= 5 ? "var(--warning)" : "var(--danger)";

    return (
      <div className="exam-layout">
        <aside className="exam-sidebar">
          <div className="stack">
            <Button variant="secondary" onClick={() => navigate("/app?section=history", { replace: true })}>
              <ArrowLeft size={15} />
              <span>Về lịch sử</span>
            </Button>
            <Section title="Kết quả" subtitle={bank?.name || ""}>
              <div className="stack" style={{ gap: "0.75rem" }}>
                {/* Score circle */}
                <div style={{ position: "relative", width: 100, height: 100, margin: "0.5rem auto" }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - scorePercent / 100)}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: scoreColor }}>{result.exam.score}</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", fontWeight: 600 }}>điểm</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <ResultStat icon={<Target size={14} />} value={`${result.exam.correctCount}/${result.exam.totalQuestions}`} label="Đúng" />
                  <ResultStat icon={<Timer size={14} />} value={formatDuration(result.exam.durationSeconds || 0)} label="Thời gian" />
                </div>
              </div>
            </Section>
          </div>
        </aside>
        <main className="exam-main">
          <Section title="Chi tiết bài thi" subtitle="Xem lại từng câu hỏi và so sánh đáp án." actions={<Button variant="secondary" onClick={() => navigate("/app?section=history")}><Clock3 size={15} /><span>Lịch sử</span></Button>}>
            <div className="stack">
              {result.items.map((item, index) => (
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
                  <CommentSection questionId={item.questionId} token={token} currentUserId={user?.id} />
                </div>
              ))}
            </div>
          </Section>
        </main>
      </div>
    );
  }

  // Exam in-progress / setup view
  return (
    <div className="exam-layout">
      <aside className="exam-sidebar">
        <div className="stack">
          <Button variant="secondary" onClick={() => navigate("/app")}>
            <ArrowLeft size={15} />
            <span>Về workspace</span>
          </Button>
          <Section title={bank?.name || "Bài thi"} subtitle={`${bank?.grade?.name || ""} · ${bank?.subject?.name || ""}`}>
            <div className="stack" style={{ gap: "0.75rem" }}>
              <div className="toolbar">
                <Badge tone={bank?.isPublic ? "success" : "warning"}>{bank?.isPublic ? "Công khai" : "Cài sẵn"}</Badge>
                <Badge tone="neutral">{bank?._count?.questions || 0} câu</Badge>
              </div>

              {session ? (
                <>
                  {isSurvivalMode ? (
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                      <CircularTimer secondsLeft={questionTimeLeft} totalSeconds={15} />
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--warning)", fontWeight: "bold" }}>
                        Chế độ Sinh tồn (15s/câu)
                      </div>
                    </div>
                  ) : isReviewMode ? (
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--success)", fontWeight: "bold" }}>
                        📖 Chế độ Ôn tập
                      </div>
                    </div>
                  ) : (
                    <CircularTimer secondsLeft={secondsLeft} totalSeconds={totalDuration} />
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Tiến trình: {progress}%</div>
                    <div className="progress-bar" style={{ marginTop: "0.5rem" }}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </Section>

          {!session && bank?.isPublic ? (
            <Subsection title="Cấu hình" subtitle="Tự chọn số câu và thời gian.">
              <div className="form-grid">
                <label className="field-group">
                  <span>Số câu</span>
                  <Input value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Thời gian (phút)</span>
                  <Input value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} disabled={isSurvivalMode} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer", marginTop: "0.5rem" }}>
                  <input type="checkbox" checked={isSurvivalMode} onChange={(e) => { setIsSurvivalMode(e.target.checked); if (e.target.checked) setIsReviewMode(false); }} />
                  🔥 Bật Chế độ sinh tồn (15s/câu)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer", marginTop: "0.5rem" }}>
                  <input type="checkbox" checked={isReviewMode} onChange={(e) => { setIsReviewMode(e.target.checked); if (e.target.checked) setIsSurvivalMode(false); }} />
                  📖 Bật Chế độ ôn tập (Hiện đáp án)
                </label>
              </div>
            </Subsection>
          ) : !session ? (
            <Subsection title="Thiết lập sẵn" subtitle="Số câu và thời gian đã cố định.">
              <div className="toolbar">
                <Badge tone="neutral">Số câu: {bank?.defaultQuestionCount || bank?._count?.questions || 0}</Badge>
                <Badge tone="neutral">Thời gian: {bank?.defaultDurationMinutes || 20} phút</Badge>
              </div>
            </Subsection>
          ) : null}

          {!session ? (
            <Button onClick={startExam} disabled={starting}>
              {starting ? <LoaderCircle size={15} className="spin" /> : <TimerReset size={15} />}
              <span>{starting ? "Đang khởi tạo..." : "Bắt đầu thi"}</span>
            </Button>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}
        </div>
      </aside>

      <main className="exam-main">
        <Section
          title={session ? `Câu ${currentIndex + 1} / ${questions.length}` : "Bài thi"}
          subtitle={currentQuestion ? currentQuestion.content : "Nhấn bắt đầu để vào bài thi."}
          actions={
            session ? (
              <div className="toolbar">
                <Button variant={favoriteState[currentQuestion?.id || 0] ? "secondary" : "ghost"} onClick={toggleFavorite} disabled={!currentQuestion} size="sm">
                  <Heart size={14} />
                  <span>{favoriteState[currentQuestion?.id || 0] ? "Đã thích" : "Yêu thích"}</span>
                </Button>
              </div>
            ) : undefined
          }
        >
          {!session ? (
            <EmptyState title="Sẵn sàng bắt đầu" description="Sau khi khởi tạo, bạn sẽ thấy câu hỏi, bộ đếm thời gian và điều hướng từng câu." />
          ) : currentQuestion ? (
            <div className="stack">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <Badge tone="primary">{currentQuestion.difficulty}</Badge>
                <Button variant="ghost" size="sm" onClick={toggleSpeak} style={{ color: isSpeaking ? "var(--primary)" : "var(--text-secondary)" }}>
                  {isSpeaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
                  <span>{isSpeaking ? "Đang đọc" : "Đọc câu hỏi"}</span>
                </Button>
              </div>
              <div className="question-card" style={{ border: "none", padding: 0, background: "transparent" }}>
                <h4 style={{ fontSize: "1rem", lineHeight: 1.6 }}>{currentQuestion.content}</h4>
                <div className="question-options" style={{ gap: "0.5rem" }}>
                  {currentQuestion.answers.map((answer, idx) => {
                    const active = selectedAnswerId === answer.id;
                    const isReview = isReviewMode && selectedAnswerId !== null;
                    const isCorrect = isReview && answer.isCorrect === true;
                    const isWrongSelection = isReview && active && answer.isCorrect === false;

                    let className = "choice";
                    if (isReview) {
                      if (isCorrect) className += " choice-correct";
                      else if (isWrongSelection) className += " choice-wrong";
                      else className += " choice-disabled";
                    } else if (active) {
                      className += " choice-active";
                    }

                    return (
                      <label key={answer.id} className={className}>
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          checked={active}
                          disabled={isReview}
                          onChange={() => {
                            if (!isReview) {
                              setAnswers((value) => ({ ...value, [currentQuestion.id]: answer.id }));
                              playTing();
                            }
                          }}
                        />
                        <div>
                          <strong style={{ color: active || isCorrect || isWrongSelection ? "inherit" : "var(--text-secondary)" }}>{String.fromCharCode(65 + idx)}.</strong>{" "}
                          {answer.content}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div className="toolbar">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} disabled={currentIndex === 0 || isSurvivalMode}>
                    <ChevronLeft size={15} />
                    <span>Trước</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))} disabled={currentIndex >= questions.length - 1}>
                    <span>Tiếp</span>
                    <ChevronRight size={15} />
                  </Button>
                </div>
                <Button onClick={() => void submitExam()} disabled={submitting}>
                  {submitting ? <LoaderCircle size={15} className="spin" /> : <CircleCheckBig size={15} />}
                  <span>{submitting ? "Đang nộp..." : "Nộp bài"}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </Section>

        {session ? (
          <div className="panel" style={{ marginTop: "1rem" }}>
            <div className="panel-head">
              <div>
                <h2>Điều hướng</h2>
                <p>Câu đã chọn được đánh dấu màu xanh.</p>
              </div>
            </div>
            <div className="question-index-grid">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  className={`index-chip ${currentIndex === index ? "index-chip-active" : ""} ${answers[question.id] != null ? "index-chip-done" : ""}`}
                  onClick={() => !isSurvivalMode && setCurrentIndex(index)}
                  disabled={isSurvivalMode}
                  style={{ opacity: isSurvivalMode && index !== currentIndex && answers[question.id] == null ? 0.3 : 1 }}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ResultStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="metric" style={{ textAlign: "center", padding: "0.75rem" }}>
      <div style={{ color: "var(--text-secondary)", marginBottom: "0.25rem", display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{value}</div>
      <div className="metric-hint" style={{ fontSize: "0.7rem" }}>{label}</div>
    </div>
  );
}
