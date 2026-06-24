import type { ApiResponse } from "@/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export function getApiBase() {
  return API_BASE;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  const hasFormData = options.body instanceof FormData;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!hasFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `HTTP ${response.status}`);
  }

  return json;
}
