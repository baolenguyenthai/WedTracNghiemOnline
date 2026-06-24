import * as React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/client";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ung-dung-trac-nghiem.token";
const USER_KEY = "ung-dung-trac-nghiem.user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await apiFetch<{ user: AuthUser }>("/auth/me", {}, token);
        if (!active) {
          return;
        }
        setUserState(response.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
      } catch {
        if (!active) {
          return;
        }
        setToken(null);
        setUserState(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login: (nextToken, nextUser) => {
        setToken(nextToken);
        setUserState(nextUser);
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      },
      logout: () => {
        setToken(null);
        setUserState(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      },
      refresh: async () => {
        if (!token) {
          return;
        }
        const response = await apiFetch<{ user: AuthUser }>("/auth/me", {}, token);
        setUserState(response.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
      },
      setUser: (nextUser) => {
        setUserState(nextUser);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      }
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
