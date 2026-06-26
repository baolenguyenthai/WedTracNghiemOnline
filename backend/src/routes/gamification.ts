import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../lib/http.js";

export const gamificationRouter = Router();

// Lấy danh sách huy hiệu hiện có (Master data)
gamificationRouter.get(
  "/badges",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const badges = await prisma.badge.findMany();
    res.json(ok({ badges }));
  })
);

// Lấy huy hiệu của bản thân
gamificationRouter.get(
  "/my-badges",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.id },
      include: { badge: true }
    });
    res.json(ok({ badges: userBadges.map((ub: any) => ({ ...ub.badge, earnedAt: ub.earnedAt })) }));
  })
);

// Lấy bảng xếp hạng (Leaderboard) theo điểm tích lũy
gamificationRouter.get(
  "/leaderboard",
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Top 10 users có điểm số trung bình cao nhất (hoặc tổng điểm cao nhất)
    const topExams = await prisma.exam.groupBy({
      by: ["userId"],
      _sum: {
        score: true
      },
      _count: {
        id: true
      },
      where: {
        userId: { not: null },
        submittedAt: { not: null }
      },
      orderBy: {
        _sum: {
          score: "desc"
        }
      },
      take: 5
    });

    const userIds = topExams.map((e: any) => e.userId!).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, username: true, avatarUrl: true }
    });

    const leaderboard = topExams.map((e: any) => {
      const u = users.find((u: any) => u.id === e.userId);
      return {
        userId: e.userId,
        fullName: u?.fullName || u?.username || "Ẩn danh",
        avatarUrl: u?.avatarUrl || null,
        totalScore: e._sum.score || 0,
        examCount: e._count.id
      };
    });

    res.json(ok({ leaderboard }));
  })
);

// API giả lập cấp phát huy hiệu (Thường chạy ngầm khi nộp bài)
export async function evaluateBadges(userId: number) {
  // Logic kiểm tra và cấp huy hiệu tự động
  // Ví dụ: Kiểm tra xem đã có 3 bài thi 10 điểm chưa
  const perfectExams = await prisma.exam.count({
    where: { userId, score: 10, submittedAt: { not: null } }
  });

  if (perfectExams >= 3) {
    // Cấp huy hiệu "Bậc thầy" (MASTER)
    await assignBadge(userId, "MASTER", "Bậc Thầy", "Đạt 10 điểm trong 3 bài thi", "👑");
  }

  // Ví dụ: Kiểm tra cú đêm (Nộp bài sau 22h)
  const currentHour = new Date().getHours();
  if (currentHour >= 22 || currentHour <= 4) {
    await assignBadge(userId, "NIGHT_OWL", "Cú Đêm", "Hoàn thành bài thi vào đêm muộn", "🦉");
  }
}

async function assignBadge(userId: number, badgeId: string, name: string, description: string, iconURL: string) {
  // Đảm bảo master data có huy hiệu này
  await prisma.badge.upsert({
    where: { id: badgeId },
    update: { name, description, iconURL },
    create: { id: badgeId, name, description, iconURL }
  });

  // Check user badge
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId } }
  });

  if (!existing) {
    await prisma.userBadge.create({
      data: { userId, badgeId }
    });
  }
}
