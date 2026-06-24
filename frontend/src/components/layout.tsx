import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { LayoutDashboard, Menu, LogOut, UserCircle2, ClipboardList, ShieldCheck, Upload, Medal, Heart, Clock3, BookOpen, Users, Layers3, Sparkles, BarChart3, CircleUserRound, X, Sun, Moon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Badge, Button } from "./common";

export type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

export function WorkspaceLayout({
  title,
  subtitle,
  sections,
  children
}: {
  title: string;
  subtitle: string;
  sections: NavItem[];
  children: (activeSection: string, setActiveSection: (value: string) => void) => React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("ui-theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ui-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((v) => (v === "dark" ? "light" : "dark"));

  const activeSection = searchParams.get("section") || sections[0]?.key || "overview";

  const activeItem = useMemo(() => sections.find((item) => item.key === activeSection) || sections[0], [sections, activeSection]);

  const setActiveSection = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", value);
    setSearchParams(next, { replace: true });
    setDrawerOpen(false);
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="workspace-shell">
      {/* Mobile overlay */}
      {drawerOpen ? (
        <div
          className="mobile-overlay mobile-only"
          onClick={() => setDrawerOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside className={`sidebar ${drawerOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" className="brand-logo" alt="UT Logo" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <strong>TracNghiem</strong>
            <span>Workspace</span>
          </div>
        </div>

        <div className="sidebar-meta">
          <div className="sidebar-user">
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
                display: "grid",
                placeItems: "center",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0
              }}
            >
              {userInitial}
            </span>
            <span>{user?.fullName}</span>
          </div>
          <Badge tone={user?.role === "ADMIN" ? "warning" : "primary"}>{user?.role === "ADMIN" ? "Quản trị viên" : "Học viên"}</Badge>
        </div>

        <nav className="sidebar-nav">
          {sections.map((item) => {
            const active = item.key === activeItem?.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                onClick={() => setActiveSection(item.key)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Button variant="ghost" onClick={logout}>
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button type="button" className="icon-button mobile-only" onClick={() => setDrawerOpen((value) => !value)}>
              {drawerOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <div className="eyebrow">{activeItem?.label || "Dashboard"}</div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          <div className="toolbar">
            <Badge tone="neutral">
              <Clock3 size={12} />
              <span>{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "short" })}</span>
            </Badge>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="workspace-content">{children(activeItem?.key || "overview", setActiveSection)}</div>
      </main>
    </div>
  );
}

export const userNavItems: NavItem[] = [
  { key: "explore", label: "Khám phá", icon: <LayoutDashboard size={16} /> },
  { key: "flashcards", label: "Học thẻ", icon: <Layers3 size={16} /> },
  { key: "multiplayer", label: "Thi đấu", icon: <Users size={16} /> },
  { key: "history", label: "Lịch sử", icon: <Clock3 size={16} /> },
  { key: "favorites", label: "Yêu thích", icon: <Heart size={16} /> },
  { key: "leaderboard", label: "Xếp hạng", icon: <Medal size={16} /> },
  { key: "upload", label: "Tải lên / AI", icon: <Upload size={16} /> },
  { key: "profile", label: "Hồ sơ", icon: <CircleUserRound size={16} /> }
];

export const adminNavItems: NavItem[] = [
  { key: "overview", label: "Tổng quan", icon: <LayoutDashboard size={16} /> },
  { key: "users", label: "Người dùng", icon: <Users size={16} /> },
  { key: "banks", label: "Bộ đề", icon: <ClipboardList size={16} /> },
  { key: "catalog", label: "Môn & cấp", icon: <BookOpen size={16} /> },
  { key: "upload", label: "Tải lên / AI", icon: <Sparkles size={16} /> },
  { key: "stats", label: "Thống kê", icon: <BarChart3 size={16} /> },
  { key: "profile", label: "Hồ sơ", icon: <CircleUserRound size={16} /> }
];
