import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, setAccessToken } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "captain" | "player";
  teamId?: string;
};

type LoginResult = {
  ok: boolean;
  mustChangePassword?: boolean;
};

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (payload: {
    email: string;
    password: string;
    name: string;
    role?: "admin" | "player";
    inviteCode: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  // ADDED: Verification function
  verifySignupOtp: (email: string, otp: string) => Promise<boolean>;
  // Forced secure password change for auto-provisioned accounts
  completePasswordReset: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    // Temporary auto-provisioned accounts must set a new password first.
    if (data.mustChangePassword) {
      return { ok: false, mustChangePassword: true };
    }
    setAccessToken(data.accessToken);
    setUser(data.user);
    return { ok: true };
  };

  const completePasswordReset = async (
    email: string,
    otp: string,
    newPassword: string
  ) => {
    const res = await apiFetch("/auth/complete-password-reset", {
      method: "POST",
      body: JSON.stringify({ email, otp, newPassword }),
      credentials: "include",
    });
    if (!res.ok) {
      let error = "Failed to update password.";
      try {
        const data = await res.json();
        error = data.error || error;
      } catch {
        // ignore parse errors
      }
      return { ok: false, error };
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return { ok: true };
  };

  const signup = async (payload: {
    email: string;
    password: string;
    name: string;
    role?: "admin" | "player";
    inviteCode: string;
  }) => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
      credentials: "include",
    });
    // If successful, server returns 200 OK (OTP sent)
    if (!res.ok) {
      let error = "Signup failed. Please try again.";
      try {
        const data = await res.json();
        error = data.error || error;
      } catch {
        // ignore parse errors
      }
      return { ok: false, error };
    }
    return { ok: true };
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
    () => ({
      user,
      login,
      signup,
      verifySignupOtp,
      completePasswordReset,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
