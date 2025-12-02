import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, setAccessToken } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "captain" | "player";
  teamId?: string;
};

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (payload: {
    email: string;
    password: string;
    name: string;
    role?: "admin" | "player";
  }) => Promise<boolean>;
  // ADDED: Verification function
  verifySignupOtp: (email: string, otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return true;
  };

  const signup = async (payload: {
    email: string;
    password: string;
    name: string;
    role?: "admin" | "player";
  }) => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
      credentials: "include",
    });
    // If successful, server returns 200 OK (OTP sent)
    if (!res.ok) return false;
    return true;
  };

  // ADDED: Call the verify endpoint
  const verifySignupOtp = async (email: string, otp: string) => {
    const res = await apiFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
      credentials: "include",
    });
    if (!res.ok) return false;
    // On success, we get the token and user data immediately
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return true;
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST", credentials: "include" });
    setAccessToken(null);
    setUser(null);
  };

  // Try load session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const at = await res.json();
        if (!at?.accessToken) return;
        setAccessToken(at.accessToken);
        const meRes = await apiFetch("/auth/me");
        if (meRes.ok) {
          const { user } = await meRes.json();
          setUser(user);
        }
      } catch {
        // ignore errors
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ user, login, signup, verifySignupOtp, logout }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
