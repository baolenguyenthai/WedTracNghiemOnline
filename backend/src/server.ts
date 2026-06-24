import { app } from "./app.js";
import { env } from "./config/env.js";
import http from "http";
import { setupSocketIO } from "./socket.js";

const port = env.PORT;

const server = http.createServer(app);

// Setup Socket.IO for real-time multiplayer
setupSocketIO(server, env.CORS_ORIGIN);

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
