import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Users, Crown, Medal, Play, Trophy, Clock, Target, AlertCircle } from "lucide-react";
import { Button, Input, Section, EmptyState, Badge } from "./common";
import { apiFetch } from "@/api/client";
import confetti from "canvas-confetti";
import { playTing, playBuzzer, playTickTock, playWin } from "@/utils/audio";

interface MultiplayerSectionProps {
  token: string | null;
  user: any;
  catalog: any;
}

export function MultiplayerSection({ token, user, catalog }: MultiplayerSectionProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [publicBanks, setPublicBanks] = useState<any[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleAnswers, setShuffleAnswers] = useState<boolean>(true);
  
  // Trạng thái lúc chơi
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    
    // Connect to Socket.IO Server
    const socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/api", "") : "http://localhost:4000";
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket"]
    });

    newSocket.on("connect", () => {
      console.log("Connected to PvP server");
    });

    newSocket.on("roomCreated", (id) => {
      setError(null);
    });

    newSocket.on("roomUpdated", (state) => {
      setRoomState(state);
      // Reset selected answer when a new question starts
      setSelectedAnswer(null);
    });

    newSocket.on("questionStarted", (data) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeLimit(data.timeLimit);
      setTimeLeft(data.timeLimit);
      setSelectedAnswer(null);
    });

    newSocket.on("gameFinished", (state) => {
      setRoomState(state);
      setCurrentQuestion(null);
      
      // Play win sound and confetti
      playWin();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']
      });
    });

    newSocket.on("error", (msg) => {
      setError(msg);
    });

    setSocket(newSocket);

    // Fetch public banks for room creation
    apiFetch<{ banks: any[] }>("/banks", {}, token).then(res => {
      setPublicBanks(res.data.banks);
    }).catch(err => {
      console.error("Failed to load public banks", err);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Bộ đếm thời gian
  useEffect(() => {
    if (!currentQuestion || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        // Play tick-tock when time is running out (<= 5s)
        if (next > 0 && next <= 5) {
          playTickTock();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion, timeLeft]);

  const createRoom = async () => {
    if (!socket || !selectedBankId) return;
    try {
      // Load câu hỏi của bank trước
      const response = await apiFetch<{ bank: any, questions: any[] }>(`/banks/${selectedBankId}/preview?questionCount=${questionCount}&shuffleQuestions=${shuffleQuestions}&shuffleAnswers=${shuffleAnswers}`, {}, token);
      
      socket.emit("createRoom", {
        bankId: Number(selectedBankId),
        questions: response.data.questions,
        user
      });
    } catch (err) {
      setError("Không thể tải bộ đề hoặc không có quyền truy cập.");
    }
  };

  const joinRoom = () => {
    if (!socket || !roomIdInput) return;
    socket.emit("joinRoom", { roomId: roomIdInput.toUpperCase(), user });
  };

  const startGame = () => {
    if (!socket || !roomState) return;
    socket.emit("startGame", { roomId: roomState.roomId });
  };

  const submitAnswer = (answerId: number) => {
    if (!socket || !roomState || selectedAnswer) return;
    setSelectedAnswer(answerId);
    
    // Play sound immediately when clicking
    // We don't know if it's correct yet until server resolves, so just a "Ting" for submission
    playTing();
    
    socket.emit("submitAnswer", { roomId: roomState.roomId, answerId });
  };

  const leaveRoom = () => {
    if (socket) {
      socket.disconnect();
      socket.connect(); // Reconnect fresh
    }
    setRoomState(null);
    setCurrentQuestion(null);
    setError(null);
  };

  // 1. Giao diện Chọn/Nhập phòng
  if (!roomState) {
    return (
      <div className="stack" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <Section title="Đấu trường Trực tiếp" subtitle="Cạnh tranh kiến thức cùng bạn bè theo thời gian thực.">
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", padding: "1rem", borderRadius: "var(--radius)", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          
          <div className="section-grid columns-2">
            {/* Tham gia phòng */}
            <div className="card stack" style={{ padding: "1.5rem", alignContent: "start" }}>
              <h3><Users size={18} style={{ verticalAlign: "middle", marginRight: 8 }}/> Tham gia phòng</h3>
              <p style={{ opacity: 0.7, fontSize: "0.9rem", marginBottom: "1rem" }}>Nhập mã phòng do bạn bè chia sẻ để bắt đầu.</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Input 
                  placeholder="Nhập mã phòng (vd: ABCDEF)" 
                  value={roomIdInput} 
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  style={{ textTransform: "uppercase", letterSpacing: "2px", fontWeight: "bold" }}
                />
                <Button onClick={joinRoom} disabled={!roomIdInput.trim()}>Vào phòng</Button>
              </div>
            </div>

            {/* Tạo phòng */}
            <div className="card stack" style={{ padding: "1.5rem", alignContent: "start" }}>
              <h3><Crown size={18} style={{ verticalAlign: "middle", marginRight: 8 }}/> Tạo phòng mới</h3>
              <p style={{ opacity: 0.7, fontSize: "0.9rem", marginBottom: "1rem" }}>Chọn một bộ đề công khai để làm đề thi cho cả phòng.</p>
              <select 
                value={selectedBankId} 
                onChange={(e) => setSelectedBankId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", marginBottom: "1rem" }}
              >
                <option value="">-- Chọn bộ đề --</option>
                {publicBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.subject?.name || bank.name} ({bank._count?.questions || 0} câu)
                  </option>
                ))}
              </select>

              <div className="form-grid form-columns-2" style={{ marginBottom: "1rem" }}>
                <label className="field-group">
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Số câu hỏi</span>
                  <Input type="number" min={1} max={100} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
                </label>
              </div>
              <div className="form-grid form-columns-2" style={{ marginBottom: "1rem" }}>
                <label className="checkbox-label" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} /> Trộn câu hỏi
                </label>
                <label className="checkbox-label" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  <input type="checkbox" checked={shuffleAnswers} onChange={(e) => setShuffleAnswers(e.target.checked)} /> Trộn đáp án
                </label>
              </div>

              <Button onClick={createRoom} disabled={!selectedBankId} variant="secondary">Tạo phòng</Button>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // 2. Giao diện sảnh chờ LOBBY
  if (roomState.status === "LOBBY") {
    const isHost = socket?.id === roomState.hostId;
    
    return (
      <Section title="Sảnh chờ" subtitle="Đợi mọi người tham gia đông đủ rồi bắt đầu.">
        <div style={{ textAlign: "center", padding: "2rem", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--primary)", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "3rem", letterSpacing: "0.2em", margin: "0 0 1rem 0", color: "var(--primary)" }}>
            {roomState.roomId}
          </h1>
          <p style={{ opacity: 0.8 }}>Mã phòng thi đấu. Hãy chia sẻ mã này cho bạn bè!</p>
          
          <div style={{ marginTop: "2rem" }}>
            {isHost ? (
              <Button onClick={startGame} disabled={roomState.players.length < 1}>
                <Play size={18} /> BẮT ĐẦU TRẬN ĐẤU
              </Button>
            ) : (
              <div style={{ padding: "1rem", color: "var(--warning)", fontWeight: "bold" }}>
                Đang chờ chủ phòng bắt đầu...
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Người chơi hiện tại ({roomState.players.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            {roomState.players.map((p: any) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", background: "var(--bg)", borderRadius: "var(--radius)", border: p.id === socket?.id ? "1px solid var(--primary)" : "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.id === roomState.hostId ? "gold" : "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold" }}>
                  {p.fullName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "bold" }}>{p.fullName} {p.id === socket?.id ? "(Bạn)" : ""}</div>
                  {p.id === roomState.hostId && <div style={{ fontSize: "0.75rem", color: "gold", fontWeight: "bold" }}>Chủ phòng</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    );
  }

  // 3. Giao diện đang chơi PLAYING
  if (roomState.status === "PLAYING" && currentQuestion) {
    const timeProgress = (timeLeft / timeLimit) * 100;
    const isUrgent = timeLeft <= 5;

    return (
      <div className="stack" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>Câu {questionIndex + 1} / {roomState.totalQuestions}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", fontWeight: "bold", color: isUrgent ? "var(--danger)" : "var(--primary)" }}>
            <Clock size={24} /> 00:{String(timeLeft).padStart(2, '0')}
          </div>
        </div>
        
        {/* Thanh tiến trình thời gian */}
        <div style={{ width: "100%", height: 8, background: "var(--bg-surface)", borderRadius: 4, overflow: "hidden", marginBottom: "2rem" }}>
          <div style={{ width: `${timeProgress}%`, height: "100%", background: isUrgent ? "var(--danger)" : "var(--primary)", transition: "width 1s linear, background 0.3s ease" }} />
        </div>

        <div className="card" style={{ padding: "2rem", textAlign: "center", fontSize: "1.25rem", marginBottom: "2rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}>
          {currentQuestion.content}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {currentQuestion.answers.map((ans: any, idx: number) => {
            const isSelected = selectedAnswer === ans.id;
            const colors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"]; // Red, Blue, Yellow, Green for Kahoot vibe
            const color = colors[idx % colors.length];

            return (
              <button
                key={ans.id}
                onClick={() => submitAnswer(ans.id)}
                disabled={selectedAnswer !== null}
                style={{
                  padding: "1.5rem",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  color: "#fff",
                  background: isSelected ? color : `${color}cc`,
                  border: isSelected ? "4px solid #fff" : "4px solid transparent",
                  borderRadius: "var(--radius-lg)",
                  cursor: selectedAnswer === null ? "pointer" : "not-allowed",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                  transition: "all 0.2s ease",
                  opacity: selectedAnswer !== null && !isSelected ? 0.5 : 1
                }}
              >
                {ans.content}
              </button>
            );
          })}
        </div>

        {selectedAnswer && (
          <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "1.2rem", fontWeight: "bold", color: "var(--text-secondary)" }}>
            Đã chọn đáp án. Đang chờ những người khác...
          </div>
        )}
      </div>
    );
  }

  // 4. Giao diện kết thúc FINISHED
  if (roomState.status === "FINISHED") {
    return (
      <Section title="Kết quả trận đấu" subtitle="Bảng xếp hạng chung cuộc">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <Trophy size={64} style={{ color: "gold", margin: "0 auto", marginBottom: "1rem" }} />
          <h1>Trận đấu kết thúc!</h1>
        </div>

        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "1rem", textAlign: "left" }}>Xếp hạng</th>
                <th style={{ padding: "1rem", textAlign: "left" }}>Học viên</th>
                <th style={{ padding: "1rem", textAlign: "right" }}>Điểm số</th>
              </tr>
            </thead>
            <tbody>
              {roomState.players.map((p: any, i: number) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: p.id === socket?.id ? "rgba(139,92,246,0.1)" : "transparent" }}>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "#cd7f32" : "inherit" }}>
                    #{i + 1}
                  </td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>
                    {p.fullName} {p.id === socket?.id && <Badge tone="primary">Bạn</Badge>}
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right", fontWeight: "bold", fontSize: "1.2rem", color: "var(--primary)" }}>
                    {p.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Button onClick={leaveRoom}>Rời phòng</Button>
        </div>
      </Section>
    );
  }

  return <div className="app-loader">Đang đồng bộ...</div>;
}
