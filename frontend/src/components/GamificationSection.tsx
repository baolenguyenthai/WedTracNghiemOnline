import React, { useEffect, useState } from "react";
import { Award, Trophy, Star } from "lucide-react";
import { Section } from "./common";

interface GamificationSectionProps {
  token: string | null;
}

export function GamificationSection({ token }: GamificationSectionProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/gamification/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => r.json()),
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/gamification/my-badges`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => r.json())
    ])
      .then(([lbData, bdgData]) => {
        if (lbData.success) setLeaderboard(lbData.data.leaderboard);
        if (bdgData.success) setBadges(bdgData.data.badges);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ padding: "2rem" }}>Đang tải thành tích...</div>;

  return (
    <div className="split" style={{ alignItems: "start" }}>
      <div className="stack">
        <Section title="Huy hiệu của bạn" subtitle="Những danh hiệu bạn đã nỗ lực đạt được">
          {badges.length === 0 ? (
            <div className="empty-state">Bạn chưa đạt huy hiệu nào. Hãy chăm chỉ thi để nhận nhé!</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {badges.map((b) => (
                <div key={b.id} className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", padding: "1rem", background: "linear-gradient(145deg, rgba(139,92,246,0.1) 0%, rgba(0,0,0,0) 100%)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: "2.5rem" }}>{b.iconURL || "🏅"}</div>
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem 0", color: "var(--primary)" }}>{b.name}</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>{b.description}</p>
                    <small style={{ opacity: 0.5 }}>Đạt được: {new Date(b.earnedAt).toLocaleDateString("vi-VN")}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="stack">
        <Section title="Bảng xếp hạng" subtitle="Top 5 học viên điểm cao nhất server">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Top</th>
                  <th>Học viên</th>
                  <th style={{ textAlign: "right" }}>Điểm tích lũy</th>
                  <th style={{ textAlign: "right" }}>Số bài thi</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((u, i) => (
                  <tr key={u.userId}>
                    <td style={{ fontWeight: "bold", color: i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "#cd7f32" : "inherit" }}>
                      #{i + 1}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.fullName} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.8rem" }}>
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : "U"}
                          </div>
                        )}
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "bold", color: "var(--primary)" }}>{Math.round(u.totalScore)}</td>
                    <td style={{ textAlign: "right", opacity: 0.7 }}>{u.examCount}</td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>Chưa có dữ liệu xếp hạng</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
