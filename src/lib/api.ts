// Simple API client with access token + refresh support

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      accessToken = data.accessToken;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: options.credentials,
  });
  if (res.status === 401 && retry) {
    const ok = await refreshAccessToken();
    if (ok) {
      return apiFetch(path, options, false);
    }
  }
  return res;
}

export { API_URL };
