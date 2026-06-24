import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";

interface Player {
  id: string; // Socket ID
  userId: number; // DB User ID
  fullName: string;
  score: number;
  isReady: boolean;
  hasAnsweredCurrent: boolean;
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
        hasAnsweredCurrent: false
      });

      rooms.set(roomId, newRoom);
      socket.join(roomId);
      
      socket.emit("roomCreated", roomId);
      io.to(roomId).emit("roomUpdated", getRoomState(newRoom));
    });

    // Tham gia phòng
    socket.on("joinRoom", ({ roomId, user }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", "Phòng không tồn tại.");
        return;
      }
      if (room.status !== "LOBBY") {
        socket.emit("error", "Trận đấu đã bắt đầu.");
        return;
      }

      socket.join(roomId);
      room.players.set(socket.id, {
        id: socket.id,
        userId: user.id,
        fullName: user.fullName,
        score: 0,
        isReady: true,
        hasAnsweredCurrent: false
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
          room.players.delete(socket.id);
          
          if (room.players.size === 0) {
            rooms.delete(roomId); // Xóa phòng nếu trống
          } else {
            // Nếu host thoát, chuyển host cho người đầu tiên
            if (room.hostId === socket.id) {
              room.hostId = Array.from(room.players.keys())[0];
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
    players: Array.from(room.players.values()).sort((a, b) => b.score - a.score)
  };
}
