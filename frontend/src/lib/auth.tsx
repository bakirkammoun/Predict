import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, type Role, type User } from "./api";

type RegistrationRole = Exclude<Role, "admin">;

interface RegistrationInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: RegistrationRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegistrationInput) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("pm_token"),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("pm_token");
    if (!t) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.data))
      .catch(() => {
        localStorage.removeItem("pm_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const r = await api.post("/auth/login", { email, password });
        localStorage.setItem("pm_token", r.data.data.token);
        setToken(r.data.data.token);
        setUser(r.data.data.user);
      },
      register: async (input) => {
        await api.post("/auth/register", input);
      },
      verifyEmail: async (email, code) => {
        await api.post("/auth/verify-email", { email, code });
      },
      logout: () => {
        localStorage.removeItem("pm_token");
        setToken(null);
        setUser(null);
      },
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, token, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth");
  return ctx;
}
