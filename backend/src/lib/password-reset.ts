import { hashToken } from "./auth.js";

type ResetEntry = {
  tokenHash: string;
  expiresAt: number;
};

const resetTokens = new Map<string, ResetEntry>();

export function setPasswordResetToken(email: string, otp: string, ttlMs = 10 * 60 * 1000) {
  resetTokens.set(email.toLowerCase(), {
    tokenHash: hashToken(otp),
    expiresAt: Date.now() + ttlMs
  });
}

export function verifyPasswordResetToken(email: string, otp: string) {
  const key = email.toLowerCase();
  const entry = resetTokens.get(key);
  if (!entry) {
    return { valid: false, reason: "OTP không hợp lệ." as const };
  }
  if (Date.now() > entry.expiresAt) {
    resetTokens.delete(key);
    return { valid: false, reason: "OTP đã hết hạn." as const };
  }
  if (hashToken(otp) !== entry.tokenHash) {
    return { valid: false, reason: "OTP không hợp lệ." as const };
  }
  return { valid: true as const };
}

export function clearPasswordResetToken(email: string) {
  resetTokens.delete(email.toLowerCase());
}
