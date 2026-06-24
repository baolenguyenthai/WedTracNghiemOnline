import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { LoadingState, EmptyState, Button } from "@/components/common";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

type Answer = {
  id: number;
  content: string;
  isCorrect: boolean;
};

type Question = {
  id: number;
  content: string;
  answers: Answer[];
};

export function FlashcardPage() {
  const { bankId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    async function loadQuestions() {
      if (!token || !bankId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ questions: Question[] }>(`/banks/${bankId}/preview?questionCount=999`, {}, token);
        setQuestions(res.data.questions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi tải câu hỏi.");
      } finally {
        setLoading(false);
      }
    }
    void loadQuestions();
  }, [bankId, token]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  if (loading) {
    return (
      <div className="layout-content stack" style={{ padding: "2rem", justifyContent: "center" }}>
        <LoadingState label="Đang tải Flashcard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout-content stack" style={{ padding: "2rem", justifyContent: "center" }}>
        <EmptyState title="Có lỗi xảy ra" description={error} />
        <Button onClick={() => navigate(-1)} variant="outline">Quay lại</Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="layout-content stack" style={{ padding: "2rem", justifyContent: "center" }}>
        <EmptyState title="Bộ đề trống" description="Bộ đề này chưa có câu hỏi nào để học." />
        <Button onClick={() => navigate(-1)} variant="outline">Quay lại</Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const correctAnswer = currentQuestion.answers.find((a) => a.isCorrect);

  return (
    <div className="layout-content stack" style={{ padding: "2rem", height: "100vh", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Quay lại
        </Button>
      </div>

      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className={`flashcard-container ${isFlipped ? "flipped" : ""}`} onClick={() => setIsFlipped(!isFlipped)}>
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <div className="flashcard-content">{currentQuestion.content}</div>
              <div className="flashcard-hint">Bấm để lật xem đáp án</div>
            </div>
            <div className="flashcard-back">
              <div className="flashcard-content">{correctAnswer?.content || "Không có đáp án đúng"}</div>
              <div className="flashcard-hint">Đã nhớ chưa?</div>
            </div>
          </div>
        </div>

        <div className="flashcard-nav">
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={currentIndex === 0}>
            <ChevronLeft size={20} /> Trước
          </Button>
          
          <div className="flashcard-progress">
            {currentIndex + 1} / {questions.length}
          </div>

          <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleNext(); }} disabled={currentIndex === questions.length - 1}>
            Tiếp <ChevronRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
