import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";

interface Player {
  id: string; // Socket ID
  userId: number; // DB User ID
  fullName: string;
  score: number;
  isReady: boolean;
  hasAnsweredCurrent: boolean;
  answers: Record<number, number>;
  isConnected?: boolean;
}

interface Room {
  roomId: string;
  hostId: string; // Socket ID
  bankId: number;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  players: Map<string, Player>;
  currentQuestionIndex: number;
  questions: any[]; // The bank's questions
  questionStartTime: number;
  questionTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();

export function setupSocketIO(server: HttpServer, corsOrigin: string) {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin.split(",").map((v) => v.trim()),
      credentials: true
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // Xử lý tạo phòng
    socket.on("createRoom", ({ bankId, questions, user }) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRoom: Room = {
        roomId,
        hostId: socket.id,
        bankId,
        status: "LOBBY",
        players: new Map(),
        currentQuestionIndex: 0,
        questions,
        questionStartTime: 0
      };
      
      // Host tự động join như một người chơi
      newRoom.players.set(socket.id, {
        id: socket.id,
        userId: user.id,
        fullName: user.fullName,
        score: 0,
        isReady: true,
        hasAnsweredCurrent: false,
        answers: {},
        isConnected: true
      });

      rooms.set(roomId, newRoom);
      socket.join(roomId);
      
      socket.emit("roomCreated", roomId);
      io.to(roomId).emit("roomUpdated", getRoomState(newRoom));
    });

    // Tham gia phòng
    socket.on("joinRoom", ({ roomId, user, guestName }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", "Phòng không tồn tại.");
        return;
      }
      if (room.status !== "LOBBY") {
        socket.emit("error", "Trận đấu đã bắt đầu.");
        return;
      }

      const actualUserId = user?.id || -Math.floor(Math.random() * 1000000);
      const actualFullName = user?.fullName || guestName || "Khách ẩn danh";

      socket.join(roomId);
      room.players.set(socket.id, {
        id: socket.id,
        userId: actualUserId,
        fullName: actualFullName,
        score: 0,
        isReady: true,
        hasAnsweredCurrent: false,
        answers: {},
        isConnected: true
      });

      io.to(roomId).emit("roomUpdated", getRoomState(room));
    });

    // Chủ phòng bắt đầu trận đấu
    socket.on("startGame", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.hostId === socket.id && room.status === "LOBBY") {
        room.status = "PLAYING";
        room.currentQuestionIndex = 0;
        startQuestion(room, io);
      }
    });

    // Người chơi nộp đáp án
    socket.on("submitAnswer", ({ roomId, answerId }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== "PLAYING") return;
      
      const player = room.players.get(socket.id);
      if (!player || player.hasAnsweredCurrent) return;

      const currentQuestion = room.questions[room.currentQuestionIndex];
      const correctAnswer = currentQuestion.answers.find((a: any) => a.isCorrect);
      
      player.answers[room.currentQuestionIndex] = answerId;
      
      if (correctAnswer && correctAnswer.id === answerId) {
        // Tính điểm: Trả lời càng nhanh điểm càng cao (Tối đa 1000đ)
        const timeTaken = Date.now() - room.questionStartTime;
        const maxTime = 60000; // 60 giây
        const scoreEarned = Math.max(100, Math.floor(((maxTime - timeTaken) / maxTime) * 1000));
        player.score += scoreEarned;
      }

      player.hasAnsweredCurrent = true;
      
      // Nếu tất cả đã trả lời thì kết thúc câu hỏi sớm
      const allAnswered = Array.from(room.players.values()).every(p => p.hasAnsweredCurrent);
      if (allAnswered) {
        if (room.questionTimer) {
          clearTimeout(room.questionTimer);
        }
        // Chờ 1s rồi qua câu tiếp theo
        room.questionTimer = setTimeout(() => {
          const currentRoom = rooms.get(roomId);
          if (currentRoom && currentRoom.status === "PLAYING") {
            nextQuestion(currentRoom, io);
          }
        }, 1000);
        io.to(roomId).emit("roomUpdated", getRoomState(room));
      } else {
        io.to(roomId).emit("roomUpdated", getRoomState(room));
      }
    });

    socket.on("disconnect", () => {
      // Dọn dẹp phòng khi user thoát
      for (const [roomId, room] of rooms.entries()) {
        if (room.players.has(socket.id)) {
          if (room.status === "LOBBY") {
            room.players.delete(socket.id);
          } else {
            // Giữ lại player để hiển thị điểm, nhưng đánh dấu là đã ngắt kết nối
            const player = room.players.get(socket.id)!;
            player.isConnected = false;
            player.hasAnsweredCurrent = true; // Không đợi họ trả lời nữa
          }
          
          const hasConnectedPlayers = Array.from(room.players.values()).some(p => p.isConnected !== false);
          
          if (!hasConnectedPlayers) {
            rooms.delete(roomId); // Xóa phòng nếu trống
          } else {
            // Nếu host thoát, chuyển host cho người đầu tiên còn kết nối
            if (room.hostId === socket.id) {
              const nextHost = Array.from(room.players.values()).find(p => p.isConnected !== false);
              if (nextHost) {
                room.hostId = nextHost.id;
              }
            }

            // Nếu đang chơi, kiểm tra xem việc ngắt kết nối có làm thỏa mãn điều kiện allAnswered không
            if (room.status === "PLAYING") {
              const allAnswered = Array.from(room.players.values()).every(p => p.hasAnsweredCurrent);
              if (allAnswered) {
                if (room.questionTimer) clearTimeout(room.questionTimer);
                room.questionTimer = setTimeout(() => {
                  const currentRoom = rooms.get(roomId);
                  if (currentRoom && currentRoom.status === "PLAYING") {
                    nextQuestion(currentRoom, io);
                  }
                }, 1000);
              }
            }

            io.to(roomId).emit("roomUpdated", getRoomState(room));
          }
        }
      }
    });
  });
}

function startQuestion(room: Room, io: Server) {
  if (room.questionTimer) {
    clearTimeout(room.questionTimer);
  }

  room.questionStartTime = Date.now();
  Array.from(room.players.values()).forEach(p => p.hasAnsweredCurrent = false);
  
  const questionIndex = room.currentQuestionIndex;

  io.to(room.roomId).emit("questionStarted", {
    questionIndex,
    question: room.questions[questionIndex],
    timeLimit: 60
  });
  
  io.to(room.roomId).emit("roomUpdated", getRoomState(room));

  // Tự động chuyển câu sau 60s
  room.questionTimer = setTimeout(() => {
    const currentRoom = rooms.get(room.roomId);
    if (currentRoom && currentRoom.status === "PLAYING" && currentRoom.currentQuestionIndex === questionIndex) {
      nextQuestion(currentRoom, io);
    }
  }, 60000);
}

function nextQuestion(room: Room, io: Server) {
  if (room.currentQuestionIndex >= room.questions.length - 1) {
    room.status = "FINISHED";
    io.to(room.roomId).emit("gameFinished", getRoomState(room));
  } else {
    room.currentQuestionIndex++;
    startQuestion(room, io);
  }
}

function getRoomState(room: Room) {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    questions: room.status === "FINISHED" ? room.questions : undefined,
    players: Array.from(room.players.values()).sort((a, b) => b.score - a.score)
  };
}
