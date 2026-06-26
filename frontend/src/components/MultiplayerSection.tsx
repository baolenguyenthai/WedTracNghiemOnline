import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Users, Crown, Medal, Play, Trophy, Clock, Target, AlertCircle, RefreshCw } from "lucide-react";
import { Button, Input, Section, EmptyState, Badge } from "./common";
import { apiFetch, getApiBase } from "@/api/client";
import confetti from "canvas-confetti";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { playTing, playBuzzer, playTickTock, playWin } from "@/utils/audio";

interface MultiplayerSectionProps {
  token: string | null;
  user: any;
  catalog: any;
}

const shuffleArray = (array: any[]) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function MultiplayerSection({ token, user, catalog }: MultiplayerSectionProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Create Room State
  const [selectedBankId, setSelectedBankId] = useState("");
  const [publicBanks, setPublicBanks] = useState<any[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [gameMode, setGameMode] = useState<"SYNCHRONOUS" | "INDEPENDENT">("SYNCHRONOUS");
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleAnswers, setShuffleAnswers] = useState<boolean>(true);
  const [timeLimitPerQuestion, setTimeLimitPerQuestion] = useState<number>(60);
  
  const [searchParams] = useSearchParams();
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomIdInput(roomParam.toUpperCase());
    }
  }, [searchParams]);
  
  // Trạng thái lúc chơi Đồng bộ (Kahoot)
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [potentialScore, setPotentialScore] = useState<number | null>(null);

  // Trạng thái lúc chơi Tự do (Independent)
  const [localQuestions, setLocalQuestions] = useState<any[]>([]);
  const [localQuestionIndex, setLocalQuestionIndex] = useState(0);
  const [isIndependentFinished, setIsIndependentFinished] = useState(false);
  const indTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
    });

    newSocket.on("gameStarted", (data) => {
      // Dành cho chế độ INDEPENDENT
      let questions = data.questions;
      if (data.shuffleQuestions) {
        questions = shuffleArray(questions);
      }
      if (data.shuffleAnswers) {
        questions = questions.map((q: any) => ({
          ...q,
          answers: shuffleArray([...q.answers])
        }));
      }
      setLocalQuestions(questions);
      setLocalQuestionIndex(0);
      setIsIndependentFinished(false);
      setSelectedAnswer(null);
      
      // Server doesn't send timeLimitPerQuestion in gameStarted yet, it's in roomState.
      // We will set timeLeft when roomState is available.
    });

    newSocket.on("questionStarted", (data) => {
      // Dành cho chế độ SYNCHRONOUS
      let question = data.question;
      if (data.shuffleAnswers) {
        question = { ...question, answers: shuffleArray([...question.answers]) };
      }
      setCurrentQuestion(question);
      setQuestionIndex(data.questionIndex);
      setTimeLimit(data.timeLimit);
      setTimeLeft(data.timeLimit);
      setSelectedAnswer(null);
      setPotentialScore(null);
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

    if (token) {
      apiFetch<{ banks: any[] }>("/banks", {}, token).then(res => {
        const sortedBanks = [...res.data.banks].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
        setPublicBanks(sortedBanks);
      }).catch(err => {
        console.error("Failed to load public banks", err);
      });
    }

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Handle setting initial timeLeft for INDEPENDENT mode once roomState is loaded
  useEffect(() => {
    if (roomState?.status === "PLAYING" && roomState?.gameMode === "INDEPENDENT" && localQuestions.length > 0 && localQuestionIndex === 0 && selectedAnswer === null && timeLeft === 0) {
      setTimeLeft(roomState.timeLimitPerQuestion);
      setTimeLimit(roomState.timeLimitPerQuestion);
    }
  }, [roomState, localQuestions, localQuestionIndex, selectedAnswer, timeLeft]);

  // Bộ đếm thời gian chung cho cả 2 chế độ
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const isPlayingSync = roomState?.status === "PLAYING" && roomState?.gameMode === "SYNCHRONOUS" && currentQuestion;
    const isPlayingInd = roomState?.status === "PLAYING" && roomState?.gameMode === "INDEPENDENT" && !isIndependentFinished && selectedAnswer === null;
    
    if (!isPlayingSync && !isPlayingInd) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next > 0 && next <= 5) {
          playTickTock();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion, timeLeft, roomState, isIndependentFinished, selectedAnswer]);

  // Handle timeout for INDEPENDENT mode
  useEffect(() => {
    if (roomState?.status === "PLAYING" && roomState?.gameMode === "INDEPENDENT" && !isIndependentFinished && selectedAnswer === null) {
      if (timeLeft <= 0) {
        // Hết giờ
        setSelectedAnswer(-1); 
        playBuzzer();
        
        const q = localQuestions[localQuestionIndex];
        socket?.emit("submitIndependentAnswer", { 
          roomId: roomState.roomId, 
          questionId: q.id, 
          answerId: -1, 
          timeTaken: roomState.timeLimitPerQuestion * 1000 
        });

        indTimeoutRef.current = setTimeout(() => {
          if (localQuestionIndex < localQuestions.length - 1) {
            setLocalQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setTimeLeft(roomState.timeLimitPerQuestion);
          } else {
            finishIndExam();
          }
        }, 2000);
      }
    }
  }, [timeLeft, roomState, isIndependentFinished, selectedAnswer, localQuestionIndex, localQuestions]);

  const createRoom = async () => {
    if (!socket || !selectedBankId) return;
    try {
      const response = await apiFetch<{ bank: any, questions: any[] }>(`/banks/${selectedBankId}/preview?questionCount=${questionCount}`, {}, token);
      
      socket.emit("createRoom", {
        bankId: Number(selectedBankId),
        questions: response.data.questions,
        user,
        gameMode,
        shuffleQuestions,
        shuffleAnswers,
        timeLimitPerQuestion
      });
    } catch (err) {
      setError("Không thể tải bộ đề hoặc không có quyền truy cập.");
    }
  };

  const joinRoom = () => {
    if (!socket || !roomIdInput) return;
    socket.emit("joinRoom", { roomId: roomIdInput.toUpperCase(), user, guestName });
  };

  const startGame = () => {
    if (!socket || !roomState) return;
    socket.emit("startGame", { roomId: roomState.roomId });
  };

  const submitSyncAnswer = (answerId: number) => {
    if (!socket || !roomState || selectedAnswer) return;
    setSelectedAnswer(answerId);
    
    const maxTime = timeLimit * 1000;
    const timeTaken = (timeLimit - timeLeft) * 1000;
    const scoreEarned = Math.max(100, Math.floor(((maxTime - timeTaken) / maxTime) * 1000));
    setPotentialScore(scoreEarned);
    
    playTing();
    socket.emit("submitAnswer", { roomId: roomState.roomId, answerId });
  };

  const submitIndAnswer = (questionId: number, answerId: number) => {
    if (!socket || !roomState || isIndependentFinished || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerId);
    const timeTaken = (roomState.timeLimitPerQuestion - timeLeft) * 1000;
    
    const currentLocalQ = localQuestions[localQuestionIndex];
    const isCorrect = currentLocalQ.answers.find((a:any) => a.id === answerId)?.isCorrect;
    
    if (isCorrect) {
      playTing(); // âm thanh chọn đúng
    } else {
      playBuzzer(); // âm thanh chọn sai
    }
    
    socket.emit("submitIndependentAnswer", { roomId: roomState.roomId, questionId, answerId, timeTaken });
    
    indTimeoutRef.current = setTimeout(() => {
      if (localQuestionIndex < localQuestions.length - 1) {
        setLocalQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setTimeLeft(roomState.timeLimitPerQuestion);
      } else {
        finishIndExam();
      }
    }, 2000);
  };

  const finishIndExam = () => {
    if (!socket || !roomState) return;
    setIsIndependentFinished(true);
    socket.emit("finishIndependentExam", { roomId: roomState.roomId });
  };

  const leaveRoom = () => {
    if (socket) {
      socket.disconnect();
      socket.connect(); 
    }
    setRoomState(null);
    setCurrentQuestion(null);
    setLocalQuestions([]);
    setError(null);
    if (indTimeoutRef.current) clearTimeout(indTimeoutRef.current);
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Input 
                  placeholder="Nhập mã phòng (vd: ABCDEF)" 
                  value={roomIdInput} 
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  style={{ textTransform: "uppercase", letterSpacing: "2px", fontWeight: "bold" }}
                />
                {!user && (
                  <Input 
                    placeholder="Nhập tên của bạn" 
                    value={guestName} 
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                )}
                <Button onClick={joinRoom} disabled={!roomIdInput.trim() || (!user && !guestName.trim())}>Vào phòng</Button>
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
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Chế độ chơi</span>
                  <select 
                    value={gameMode} 
                    onChange={(e: any) => {
                      setGameMode(e.target.value);
                      if (e.target.value === "SYNCHRONOUS") setShuffleQuestions(false);
                    }}
                    style={{ padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                  >
                    <option value="SYNCHRONOUS">Đồng bộ (Kahoot)</option>
                    <option value="INDEPENDENT">Tự do (Cá nhân)</option>
                  </select>
                </label>
                <label className="field-group">
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Số câu hỏi</span>
                  <Input type="number" min={1} max={100} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
                </label>
              </div>

              <div className="form-grid form-columns-2" style={{ marginBottom: "1rem" }}>
                <label className="checkbox-label" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} disabled={gameMode === "SYNCHRONOUS"} /> 
                  Trộn câu hỏi {gameMode === "SYNCHRONOUS" && "(Không hỗ trợ)"}
                </label>
                <label className="checkbox-label" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  <input type="checkbox" checked={shuffleAnswers} onChange={(e) => setShuffleAnswers(e.target.checked)} /> Trộn đáp án
                </label>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="field-group">
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Thời gian mỗi câu (giây)</span>
                  <Input type="number" min={10} max={300} value={timeLimitPerQuestion} onChange={(e) => setTimeLimitPerQuestion(Number(e.target.value))} />
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
          <Badge tone={roomState.gameMode === "SYNCHRONOUS" ? "primary" : "warning"} style={{ marginBottom: "1rem" }}>
            {roomState.gameMode === "SYNCHRONOUS" ? "Chế độ: Đồng bộ (Kahoot)" : "Chế độ: Tự do (Mỗi người 1 đề)"}
          </Badge>
          <h1 style={{ fontSize: "3rem", letterSpacing: "0.2em", margin: "0 0 1rem 0", color: "var(--primary)" }}>
            {roomState.roomId}
          </h1>
          <p style={{ opacity: 0.8 }}>Mã phòng thi đấu. Hãy chia sẻ mã này cho bạn bè!</p>
          
          <div style={{ marginTop: "2rem" }}>
            {isHost ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                <QRCodeSVG value={`${window.location.origin}/app?section=multiplayer&room=${roomState.roomId}`} size={160} style={{ margin: "0 auto" }} />
                <Button variant="ghost" size="sm" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/app?section=multiplayer&room=${roomState.roomId}`);
                  alert("Đã copy link chia sẻ!");
                }}>
                  Copy Link Tham Gia
                </Button>
                <div>
                  <Button onClick={startGame} disabled={roomState.players.length < 1}>
                    <Play size={18} /> BẮT ĐẦU TRẬN ĐẤU
                  </Button>
                </div>
              </div>
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
                <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", background: p.id === roomState.hostId ? "gold" : "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", overflow: "hidden" }}>
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl.startsWith('http') ? p.avatarUrl : `${getApiBase().replace('/api', '')}${p.avatarUrl}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    p.fullName?.[0]?.toUpperCase()
                  )}
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

  // 3. Giao diện đang chơi PLAYING (SYNCHRONOUS)
  if (roomState.status === "PLAYING" && roomState.gameMode === "SYNCHRONOUS" && currentQuestion) {
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", WebkitTapHighlightColor: "transparent" }}>
          {currentQuestion.answers.map((ans: any, idx: number) => {
            const isSelected = selectedAnswer === ans.id;
            const colors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"]; 
            const color = colors[idx % colors.length];

            return (
              <button
                key={ans.id}
                onClick={() => submitSyncAnswer(ans.id)}
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
            {potentialScore !== null && (
              <div style={{ marginTop: "0.5rem", color: "var(--primary)" }}>
                Nếu đúng, bạn sẽ được cộng +{potentialScore} điểm!
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3b. Giao diện đang chơi PLAYING (INDEPENDENT)
  if (roomState.status === "PLAYING" && roomState.gameMode === "INDEPENDENT" && localQuestions.length > 0) {
    if (isIndependentFinished) {
      return (
        <Section title="Đã nộp bài" subtitle="Chờ các người chơi khác hoàn thành...">
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <RefreshCw size={48} className="spin" style={{ color: "var(--primary)", margin: "0 auto", marginBottom: "1rem" }} />
            <h3>Bạn đã hoàn thành bài thi!</h3>
            <p style={{ opacity: 0.8 }}>Trận đấu sẽ tự động kết thúc khi tất cả mọi người nộp bài.</p>
          </div>
        </Section>
      );
    }

    const currentLocalQ = localQuestions[localQuestionIndex];
    const timeProgress = (timeLeft / roomState.timeLimitPerQuestion) * 100;
    const isUrgent = timeLeft <= 5;
    
    // Sort room players by score to find rank
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const myRank = sortedPlayers.findIndex(p => p.id === socket?.id) + 1;
    const myPlayer = sortedPlayers.find(p => p.id === socket?.id);

    return (
      <div className="stack" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <Badge tone="primary" style={{ fontSize: "1.1rem", padding: "0.25rem 0.75rem" }}>
              Thứ hạng: #{myRank > 0 ? myRank : "-"}
            </Badge>
            <span style={{ marginLeft: "1rem", fontWeight: "bold", fontSize: "1.1rem" }}>
              Điểm: {myPlayer?.score || 0}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", fontWeight: "bold", color: isUrgent ? "var(--danger)" : "var(--primary)" }}>
            <Clock size={24} /> 00:{String(timeLeft).padStart(2, '0')}
          </div>
        </div>
        
        {/* Thanh tiến trình thời gian */}
        <div style={{ width: "100%", height: 8, background: "var(--bg-surface)", borderRadius: 4, overflow: "hidden", marginBottom: "2rem" }}>
          <div style={{ width: `${timeProgress}%`, height: "100%", background: isUrgent ? "var(--danger)" : "var(--primary)", transition: "width 1s linear, background 0.3s ease" }} />
        </div>

        <div className="card" style={{ padding: "2rem", textAlign: "center", fontSize: "1.25rem", marginBottom: "2rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: "1.2rem", opacity: 0.7, marginBottom: "0.5rem" }}>
            Câu {localQuestionIndex + 1} / {localQuestions.length}
          </h2>
          <div>{currentLocalQ.content}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", WebkitTapHighlightColor: "transparent" }}>
          {currentLocalQ.answers.map((ans: any, idx: number) => {
            const isSelected = selectedAnswer === ans.id;
            const colors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"];
            const baseColor = colors[idx % colors.length];

            let btnColor = `${baseColor}cc`;
            let border = "4px solid transparent";
            let opacity = selectedAnswer !== null ? 0.4 : 1;
            let transform = "scale(1)";
            
            if (selectedAnswer !== null) {
              if (ans.isCorrect) {
                btnColor = "#22c55e"; // Hiện màu xanh cho đáp án đúng
                border = "4px solid #fff";
                opacity = 1;
                transform = "scale(1.02)";
              } else if (isSelected) {
                btnColor = "#ef4444"; // Hiện màu đỏ cho đáp án sai nếu lỡ chọn
                border = "4px solid #fff";
                opacity = 1;
                transform = "scale(1.02)";
              }
            }

            return (
              <button
                key={ans.id}
                onClick={() => submitIndAnswer(currentLocalQ.id, ans.id)}
                disabled={selectedAnswer !== null}
                style={{
                  padding: "1.5rem",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  color: "#fff",
                  background: btnColor,
                  border: border,
                  borderRadius: "var(--radius-lg)",
                  cursor: selectedAnswer === null ? "pointer" : "not-allowed",
                  transform: transform,
                  transition: "all 0.2s ease",
                  opacity: opacity
                }}
              >
                {ans.content}
              </button>
            );
          })}
        </div>
        
        {selectedAnswer !== null && (
          <div style={{ textAlign: "center", marginTop: "1rem", fontWeight: "bold", opacity: 0.8 }}>
            Tự động chuyển câu tiếp theo...
          </div>
        )}
      </div>
    );
  }

  // 4. Giao diện kết thúc FINISHED
  if (roomState.status === "FINISHED") {
    const myPlayer = roomState.players.find((p: any) => p.id === socket?.id);

    return (
      <Section title="Kết quả trận đấu" subtitle="Bảng xếp hạng chung cuộc">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <Trophy size={64} style={{ color: "gold", margin: "0 auto", marginBottom: "1rem" }} />
          <h1>Trận đấu kết thúc!</h1>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
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
                  <td style={{ padding: "1rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", overflow: "hidden", flexShrink: 0 }}>
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl.startsWith('http') ? p.avatarUrl : `${getApiBase().replace('/api', '')}${p.avatarUrl}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        p.fullName?.[0]?.toUpperCase()
                      )}
                    </div>
                    {p.fullName} {p.id === socket?.id && <Badge tone="primary">Bạn</Badge>}
                    {p.isConnected === false && <span style={{ opacity: 0.5, fontSize: "0.8rem", marginLeft: "0.5rem" }}>(Đã thoát)</span>}
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right", fontWeight: "bold", fontSize: "1.2rem", color: "var(--primary)" }}>
                    {p.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {roomState.questions && (
          <div className="card">
            <h3>Xem lại câu hỏi</h3>
            <p style={{ opacity: 0.7, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Danh sách đáp án bạn đã chọn so với đáp án đúng.
            </p>
            <div className="stack" style={{ gap: "1.5rem" }}>
              {roomState.questions.map((q: any, i: number) => {
                const myAnswerId = myPlayer?.answers?.[i];
                return (
                  <div key={q.id} style={{ background: "var(--bg)", padding: "1.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "1rem", fontSize: "1.1rem" }}>Câu {i + 1}: {q.content}</div>
                    <div className="stack" style={{ gap: "0.5rem" }}>
                      {q.answers.map((ans: any) => {
                        const isCorrect = ans.isCorrect;
                        const isMySelection = ans.id === myAnswerId;
                        let bg = "var(--bg-surface)";
                        let border = "1px solid var(--border)";
                        let icon = null;
                        
                        if (isCorrect) {
                          bg = "rgba(34,197,94,0.1)";
                          border = "1px solid var(--success)";
                          icon = <span style={{ color: "var(--success)", fontWeight: "bold" }}>✔️ Đáp án đúng{isMySelection && " (Bạn chọn)"}</span>;
                        } else if (isMySelection) {
                          bg = "rgba(239,68,68,0.1)";
                          border = "1px solid var(--danger)";
                          icon = <span style={{ color: "var(--danger)", fontWeight: "bold" }}>❌ Bạn chọn sai</span>;
                        }

                        return (
                          <div key={ans.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderRadius: "var(--radius)", background: bg, border }}>
                            <span>{ans.content}</span>
                            {icon}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Button onClick={leaveRoom}>Rời phòng</Button>
        </div>
      </Section>
    );
  }

  return <div className="app-loader">Đang chờ kết nối...</div>;
}
