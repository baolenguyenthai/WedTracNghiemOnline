import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { metaRouter } from "./routes/meta.js";
import { banksRouter } from "./routes/banks.js";
import { examsRouter } from "./routes/exams.js";
import { favoritesRouter } from "./routes/favorites.js";
import { adminRouter } from "./routes/admin.js";
import { gamificationRouter } from "./routes/gamification.js";
import { commentsRouter } from "./routes/comments.js";
import { studyRouter } from "./routes/study.js";
import { notFound, errorHandler } from "./middleware/error.js";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()),
    credentials: true
  })
);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "UngDungTracNghiem backend is running."
  });
});

app.use("/api/auth", authRouter);
app.use("/api/meta", metaRouter);
app.use("/api/banks", banksRouter);
app.use("/api/exams", examsRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/gamification", gamificationRouter);
app.use("/api", commentsRouter); // routes inside are like /questions/:id/comments
app.use("/api/study", studyRouter);

app.use(notFound);
app.use(errorHandler);
