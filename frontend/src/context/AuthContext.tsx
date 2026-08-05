import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, getToken, setToken as persistToken } from '../api/client';

export interface User {
  id: number;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ user: User }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {
        persistToken(null);
        setTokenState(null);
      })
      .finally(() => setLoading(false));
    // Only re-check on mount; login()/signup() set user directly without refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persistToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }

  async function signup(email: string, password: string) {
    const res = await apiFetch<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persistToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }

  function logout() {
    persistToken(null);
    setTokenState(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
