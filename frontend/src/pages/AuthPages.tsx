import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Mail, Lock, UserRound, ArrowRight, WandSparkles, Eye, EyeOff, Zap, BookOpen, Sun, Moon } from "lucide-react";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/common";
import confetti from "canvas-confetti";
import { playPop } from "@/utils/audio";

function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];
    let rockets: { x: number; y: number; targetY: number; vy: number; color: string }[] = [];
    let comets: { x: number; y: number; vx: number; vy: number; length: number; opacity: number; color: string }[] = [];
    let animationFrameId: number;
    let mouse = { x: -1000, y: -1000 };
    
    let isWarping = false;
    let warpSpeed = 0;
    let warpFade = 0;
    let warpLines: { x: number; y: number; length: number; speed: number; angle: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const numParticles = Math.floor((window.innerWidth * window.innerHeight) / 15000);
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 1.5 + 0.5,
        });
      }
    };

    const updateMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleCanvasClick = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.detail.x - rect.left;
      const cy = e.detail.y - rect.top;
      
      rockets.push({
        x: cx,
        y: canvas.height,
        targetY: cy,
        vy: -25,
        color: ['#8b5cf6', '#0ea5e9', '#d8b4fe', '#ffffff'][Math.floor(Math.random() * 4)]
      });
    };

    const handleWarp = () => {
      isWarping = true;
      playPop();

      for (let i = 0; i < 200; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 100 + 10;
        warpLines.push({
          x: window.innerWidth / 2 + Math.cos(angle) * dist,
          y: window.innerHeight / 2 + Math.sin(angle) * dist,
          length: Math.random() * 20 + 10,
          speed: Math.random() * 15 + 5,
          angle: angle
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      const color = isDark ? "rgba(139, 92, 246," : "rgba(99, 102, 241,";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150) {
          // Repel effect
          const forceDirectionX = dx / dist;
          const forceDirectionY = dy / dist;
          const force = (150 - dist) / 150;
          const repelStrength = 1.5;
          
          p.vx -= forceDirectionX * force * repelStrength * 0.05;
          p.vy -= forceDirectionY * force * repelStrength * 0.05;

          // Connection line
          ctx.beginPath();
          ctx.strokeStyle = `${color} ${0.3 * (1 - dist / 150)})`;
          ctx.lineWidth = 1.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        // Limit speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2) {
          p.vx = (p.vx / speed) * 2;
          p.vy = (p.vy / speed) * 2;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color} 0.5)`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `${color} ${0.15 * (1 - dist2 / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        
        ctx.beginPath();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x, r.y + 35);
        ctx.stroke();

        r.y += r.vy;

        if (r.y <= r.targetY) {
          confetti({
            particleCount: 60,
            spread: 80,
            startVelocity: 35,
            origin: { x: r.x / window.innerWidth, y: r.targetY / window.innerHeight },
            colors: ['#8b5cf6', '#0ea5e9', '#d8b4fe', '#ffffff', '#38bdf8'],
            shapes: ['circle', 'star'],
            scalar: 0.8,
            zIndex: 0
          });

          playPop();

          for (let j = 0; j < particles.length; j++) {
            const p = particles[j];
            const dx = p.x - r.x;
            const dy = p.y - r.targetY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 350) {
              const force = (350 - dist) / 350;
              p.vx += (dx / dist) * force * 20;
              p.vy += (dy / dist) * force * 20;
            }
          }
          rockets.splice(i, 1);
        }
      }

      // Spawn comets occasionally
      if (Math.random() < 0.005) {
        const fromLeft = Math.random() > 0.5;
        comets.push({
          x: fromLeft ? -100 : canvas.width + 100,
          y: Math.random() * (canvas.height / 1.5),
          vx: (fromLeft ? 1 : -1) * (Math.random() * 5 + 8),
          vy: Math.random() * 3 + 1,
          length: Math.random() * 60 + 40,
          opacity: Math.random() * 0.4 + 0.3,
          color: ['255, 255, 255', '192, 132, 252', '56, 189, 248'][Math.floor(Math.random() * 3)]
        });
      }

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        
        const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        const dirX = c.vx / speed;
        const dirY = c.vy / speed;
        const tailX = c.x - dirX * c.length;
        const tailY = c.y - dirY * c.length;

        const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        grad.addColorStop(0, `rgba(${c.color}, ${c.opacity})`);
        grad.addColorStop(1, `rgba(${c.color}, 0)`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.random() * 1.5 + 1; // slightly flickering thickness
        ctx.lineCap = "round";
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        c.x += c.vx;
        c.y += c.vy;

        if (c.x < -200 || c.x > canvas.width + 200 || c.y > canvas.height + 200) {
          comets.splice(i, 1);
        }
      }

      if (isWarping) {
        warpSpeed += 1.2;
        warpFade += 0.012;
        
        // Draw warp lines
        for (let i = 0; i < warpLines.length; i++) {
          const wl = warpLines[i];
          wl.speed += warpSpeed * 0.3;
          wl.length += warpSpeed * 0.8;
          wl.x += Math.cos(wl.angle) * wl.speed;
          wl.y += Math.sin(wl.angle) * wl.speed;

          ctx.beginPath();
          ctx.strokeStyle = isDark ? `rgba(255, 255, 255, ${Math.min(warpFade * 5, 0.9)})` : `rgba(139, 92, 246, ${Math.min(warpFade * 5, 0.9)})`;
          ctx.lineWidth = 1.5 + warpSpeed * 0.02;
          ctx.moveTo(wl.x, wl.y);
          ctx.lineTo(wl.x - Math.cos(wl.angle) * wl.length, wl.y - Math.sin(wl.angle) * wl.length);
          ctx.stroke();
        }

        // Accelerate existing particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - canvas.width / 2;
          const dy = p.y - canvas.height / 2;
          const angle = Math.atan2(dy, dx);
          
          p.vx += Math.cos(angle) * warpSpeed * 0.2;
          p.vy += Math.sin(angle) * warpSpeed * 0.2;

          ctx.beginPath();
          ctx.strokeStyle = isDark ? `rgba(255, 255, 255, ${Math.min(warpFade * 3, 0.5)})` : `rgba(139, 92, 246, ${Math.min(warpFade * 3, 0.5)})`;
          ctx.lineWidth = 1 + warpSpeed * 0.05;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
          ctx.stroke();
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${warpFade})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", updateMouse);
    window.addEventListener("auth-bg-click", handleCanvasClick);
    window.addEventListener("auth-warp", handleWarp);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", updateMouse);
      window.removeEventListener("auth-bg-click", handleCanvasClick);
      window.removeEventListener("auth-warp", handleWarp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

function AuthShell({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [theme, setTheme] = useState(() => localStorage.getItem("ui-theme") || "dark");
  const [isWarping, setIsWarping] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ui-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onWarp = () => setIsWarping(true);
    window.addEventListener("auth-warp", onWarp);
    return () => window.removeEventListener("auth-warp", onWarp);
  }, []);

  const toggleTheme = () => setTheme((v) => (v === "dark" ? "light" : "dark"));

  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    setMousePos({ x, y });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      window.dispatchEvent(new CustomEvent('auth-bg-click', { 
        detail: { x: e.clientX, y: e.clientY }
      }));
    }
  };

  return (
    <div 
      className="auth-screen" 
      onClick={handleClick}
    >
      <NetworkBackground />
      <button
        type="button"
        className="icon-button"
        onClick={toggleTheme}
        title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
        style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className={`auth-card ${isWarping ? "warp-out" : ""}`}>
        <div className="auth-hero">
          <img src="/logo.png" className="brand-logo large" alt="UT Logo" />
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="auth-hero-badges">
            <span className="mini-badge">
              <Zap size={12} />
              <span>Trắc nghiệm online</span>
            </span>
            <span className="mini-badge">
              <ShieldCheck size={12} />
              <span>Quản trị / Học viên</span>
            </span>
            <span className="mini-badge">
              <BookOpen size={12} />
              <span>Kho đề phong phú</span>
            </span>
          </div>
        </div>
        <div className="auth-form">{children}</div>
      </div>
      <div className="auth-footer">{footer}</div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin đăng nhập.");
      setIsShake(true);
      setTimeout(() => setIsShake(false), 500);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail, password })
      });
      
      window.dispatchEvent(new CustomEvent('auth-warp'));
      
      setTimeout(() => {
        login(response.data.token, response.data.user);
        navigate("/app", { replace: true });
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập.");
      setIsShake(true);
      setTimeout(() => setIsShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isShake ? "shake-animation" : ""}>
    <AuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để quản lý bộ đề, làm bài thi và theo dõi tiến trình học tập."
      footer={
        <p>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link> · <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="auth-fields">
        <label>
          <span>Tên đăng nhập hoặc email</span>
          <Input value={usernameOrEmail} onChange={(event) => setUsernameOrEmail(event.target.value)} placeholder="Nhập tên đăng nhập hoặc email..." />
        </label>
        <label>
          <span>Mật khẩu</span>
          <div style={{ position: "relative" }}>
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              style={{ paddingRight: "2.5rem" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "0.65rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                display: "flex",
                padding: "0.25rem"
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="toolbar" style={{ gap: "0.5rem", marginTop: "0.25rem", width: "100%" }}>
          <div style={{ flex: 1, display: "flex", width: "100%" }}>
            <Button type="submit" disabled={loading}>
              {loading ? null : <Lock size={15} />}
              <span>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</span>
            </Button>
          </div>
        </div>
      </form>
    </AuthShell>
    </div>
  );
}

export function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Vui lòng nhập đầy đủ tất cả thông tin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ token: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form)
      });
      login(response.data.token, response.data.user);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng ký.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Tạo tài khoản mới"
      subtitle="Tham gia hệ thống trắc nghiệm — lưu kết quả, yêu thích câu hỏi và tải lên bộ đề."
      footer={
        <p>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="auth-fields">
        <label>
          <span>Họ tên</span>
          <Input value={form.fullName} onChange={(event) => setForm((value) => ({ ...value, fullName: event.target.value }))} placeholder="Nguyễn Văn A" />
        </label>
        <label>
          <span>Tên đăng nhập</span>
          <Input value={form.username} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} placeholder="username" />
        </label>
        <label>
          <span>Email</span>
          <Input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="email@example.com" />
        </label>
        <label>
          <span>Mật khẩu</span>
          <Input type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} placeholder="Tối thiểu 6 ký tự" />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <Button type="submit" disabled={loading}>
          {loading ? null : <UserRound size={15} />}
          <span>{loading ? "Đang tạo..." : "Đăng ký"}</span>
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ devOtp: string | null }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setDevOtp(response.data.devOtp);
      setMessage("Đã gửi OTP. Hãy nhập mã để đặt lại mật khẩu.");
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi OTP.");
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otp.trim() || !newPassword.trim()) {
      setError("Vui lòng nhập mã OTP và mật khẩu mới.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, otp, newPassword })
      });
      setMessage("Đặt lại mật khẩu thành công.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đặt lại mật khẩu.");
    }
  };

  return (
    <AuthShell
      title="Khôi phục mật khẩu"
      subtitle="Nhập email để nhận mã OTP và đặt lại mật khẩu chỉ trong vài bước."
      footer={<p><Link to="/login">← Quay lại đăng nhập</Link></p>}
    >
      {step === "request" ? (
        <form onSubmit={requestOtp} className="auth-fields">
          <div className="form-note" style={{ marginBottom: "0.25rem" }}>
            Bước 1/2 — Nhập email đã đăng ký
          </div>
          <label>
            <span>Email</span>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}
          <Button type="submit">
            <Mail size={15} />
            <span>Gửi OTP</span>
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="auth-fields">
          <div className="form-note" style={{ marginBottom: "0.25rem" }}>
            Bước 2/2 — Nhập OTP và mật khẩu mới
          </div>
          <label>
            <span>Email</span>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Mã OTP</span>
            <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Nhập mã 6 chữ số" />
          </label>
          <label>
            <span>Mật khẩu mới</span>
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}
          <Button type="submit">
            <Lock size={15} />
            <span>Đặt lại mật khẩu</span>
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
