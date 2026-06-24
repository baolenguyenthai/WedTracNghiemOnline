import React, { useState, useEffect } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { apiFetch } from "@/api/client";
import { Button, Input } from "./common";

export function CommentSection({ questionId, token, currentUserId }: { questionId: number, token: string | null, currentUserId?: number }) {
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadComments = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ comments: any[] }>(`/questions/${questionId}/comments`, {}, token);
      setComments(res.data.comments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      void loadComments();
    }
  }, [expanded, questionId, token]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !token) return;
    try {
      await apiFetch(`/questions/${questionId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content })
      }, token);
      setContent("");
      await loadComments();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!token) return;
    try {
      await apiFetch(`/questions/comments/${commentId}`, { method: "DELETE" }, token);
      await loadComments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
        <MessageSquare size={14} />
        <span>{expanded ? "Ẩn bình luận" : `Thảo luận (${comments.length > 0 ? comments.length : "Mở"})`}</span>
      </Button>

      {expanded && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(0,0,0,0.1)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {loading ? (
            <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>Đang tải...</div>
          ) : comments.length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>Chưa có bình luận nào. Hãy là người đầu tiên!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "0.5rem", background: "var(--bg-surface)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.7rem", fontWeight: "bold" }}>
                    {c.user.fullName?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--primary)" }}>{c.user.fullName || c.user.username}</strong>
                      <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{new Date(c.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", lineHeight: 1.4 }}>{c.content}</div>
                  </div>
                  {(currentUserId === c.userId || currentUserId === 1) && (
                    <button onClick={() => deleteComment(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", opacity: 0.7, padding: "0.25rem" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={postComment} style={{ display: "flex", gap: "0.5rem" }}>
            <Input 
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              placeholder="Thêm bình luận..." 
              style={{ flex: 1 }} 
            />
            <Button type="submit" size="sm" disabled={!content.trim()}>
              <Send size={14} />
              <span>Gửi</span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
