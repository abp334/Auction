import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, setAccessToken } from '@/lib/api';

type User = { id: string; email: string; name: string; role: 'admin' | 'captain' | 'player'; teamId?: string };

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (payload: { email: string; password: string; name: string; role: User['role']; teamId?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return true;
  };

  const signup = async (payload: { email: string; password: string; name: string; role: User['role']; teamId?: string }) => {
    const res = await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(payload), credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    return true;
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
    setAccessToken(null);
    setUser(null);
  };

  // Try load session
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!res.ok) return;
        const at = await res.json();
        if (!at?.accessToken) return;
        setAccessToken(at.accessToken);
        const meRes = await apiFetch('/auth/me');
        if (meRes.ok) {
          const { user } = await meRes.json();
          setUser(user);
        }
      } catch {
        // ignore refresh failures on cold load
      }
    })();
  }, []);

  const value = useMemo(() => ({ user, login, signup, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


