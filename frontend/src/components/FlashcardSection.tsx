import React, { useEffect, useState } from "react";
import { Layers3, Check, X, RotateCcw } from "lucide-react";
import { Section, EmptyState, Button } from "./common";

interface FlashcardSectionProps {
  token: string | null;
}

export function FlashcardSection({ token }: FlashcardSectionProps) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/study/weak-questions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCards(data.data.weakQuestions);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ padding: "2rem" }}>Đang tải thẻ ghi nhớ...</div>;

  if (cards.length === 0) {
    return (
      <Section title="Ôn tập thẻ ghi nhớ" subtitle="Không có dữ liệu">
        <EmptyState title="Bạn chưa có câu nào làm sai nhiều lần!" />
      </Section>
    );
  }

  const currentCard = cards[currentIndex];
  const question = currentCard.question;
  const correctAnswers = question.answers.filter((a: any) => a.isCorrect);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150); // wait for flip back
  };

  return (
    <Section title="Thẻ ghi nhớ (Flashcards)" subtitle="Ôn lại những câu bạn thường xuyên làm sai nhất.">
      <div className="flashcard-container" style={{ perspective: 1000, margin: "2rem auto", maxWidth: 600, height: 400 }}>
        <div 
          className="flashcard-inner" 
          style={{ 
            position: "relative", 
            width: "100%", 
            height: "100%", 
            transition: "transform 0.6s", 
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            cursor: "pointer"
          }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Mặt trước: Câu hỏi */}
          <div 
            style={{ 
              position: "absolute", 
              width: "100%", 
              height: "100%", 
              backfaceVisibility: "hidden", 
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)"
            }}
          >
            <div style={{ color: "var(--warning)", marginBottom: "1rem", fontWeight: "bold" }}>
              Đã sai {currentCard.failCount} lần
            </div>
            <h3 style={{ fontSize: "1.25rem", lineHeight: 1.5, margin: 0 }}>{question.content}</h3>
            <div style={{ marginTop: "auto", opacity: 0.5, fontSize: "0.85rem" }}>Bấm để lật thẻ</div>
          </div>

          {/* Mặt sau: Đáp án */}
          <div 
            style={{ 
              position: "absolute", 
              width: "100%", 
              height: "100%", 
              backfaceVisibility: "hidden", 
              background: "linear-gradient(145deg, var(--bg-surface) 0%, rgba(16, 185, 129, 0.1) 100%)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius-lg)",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              transform: "rotateY(180deg)",
              boxShadow: "0 10px 30px -10px rgba(16, 185, 129, 0.2)"
            }}
          >
            <h4 style={{ color: "var(--success)", marginBottom: "1rem" }}>Đáp án đúng:</h4>
            {correctAnswers.map((ans: any, i: number) => (
              <div key={i} style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                {ans.content}
              </div>
            ))}
            <div style={{ marginTop: "auto", display: "flex", gap: "1rem" }}>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); nextCard(); }}>
                Tiếp tục <Check size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: "center", marginTop: "1rem", opacity: 0.7 }}>
        Thẻ {currentIndex + 1} / {cards.length}
      </div>
    </Section>
  );
}
