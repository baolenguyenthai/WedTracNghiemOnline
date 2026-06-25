import * as React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { LoadingState } from "@/components/common";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "@/pages/AuthPages";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { ExamPage } from "@/pages/ExamPage";
import { FlashcardPage } from "@/pages/FlashcardPage";

import { useLocation } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="app-loader"><LoadingState label="Đang đồng bộ phiên đăng nhập..." /></div>;
  }

  const queryParams = new URLSearchParams(location.search);
  const isGuestJoining = queryParams.get("section") === "multiplayer" && queryParams.has("room");

  if (!token && !isGuestJoining) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { token, user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={token ? "/app" : "/login"} replace />} />
      <Route path="/login" element={token ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={token ? <Navigate to="/app" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={token ? <Navigate to="/app" replace /> : <ForgotPasswordPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:bankId"
        element={
          <ProtectedRoute>
            <ExamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flashcard/:bankId"
        element={
          <ProtectedRoute>
            <FlashcardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? "/app" : "/login"} replace />} />
    </Routes>
  );
}
