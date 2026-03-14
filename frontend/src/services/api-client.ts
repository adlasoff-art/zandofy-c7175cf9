/**
 * Client pour les appels au backend FastAPI (support, visual-search, etc.).
 * Utilise VITE_API_URL et envoie le token JWT (session utilisateur) dans Authorization.
 */
import { supabase } from "@/integrations/supabase/client";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function resolveAuthToken(explicitToken?: string): Promise<string | null> {
  if (explicitToken) return explicitToken;

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch {
    // fallback legacy only
  }

  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("access_token");
  }

  return null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token: optToken, ...init } = options;
  const token = await resolveAuthToken(optToken);
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail || err);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiWsUrl(path: string): string {
  return `${API_URL.replace(/^http/, "ws")}${path}`;
}
