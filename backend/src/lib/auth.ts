import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";

export type SafeUser = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: "ACTIVE" | "LOCKED";
  createdAt: Date;
};

type UserWithRole = Prisma.UserGetPayload<{
  include: { vaiTro: true };
}>;

export function toSafeUser(user: UserWithRole): SafeUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    avatarUrl: user.avatarUrl ?? null,
    role: user.vaiTro?.name ?? "USER",
    status: user.status === 1 ? "ACTIVE" : "LOCKED",
    createdAt: user.createdAt
  };
}

export async function hashPassword(password: string) {
  return password;
}

export async function comparePassword(password: string, hash: string) {
  return password === hash;
}

export function signToken(user: SafeUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as SafeUser;
}

export function createRandomToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
