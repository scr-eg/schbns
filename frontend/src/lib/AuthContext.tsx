import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiGet, apiPost } from "./api";

export interface CurrentUser {
  id: string;
  username: string;
  role_code: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const res = await apiGet<{ user: CurrentUser }>("/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();

    // تجديد صامت لـ access token كل 10 دقائق أثناء توفر الاتصال فقط،
    // لتقليل احتمال انتهاء الجلسة أثناء فترة عمل لاحقة دون اتصال بالإنترنت.
    // (تجديد الجلسة نفسه يتطلب اتصالاً بالخادم، فلا يمكن تنفيذه أثناء الانقطاع الفعلي)
    const interval = setInterval(() => {
      if (navigator.onLine) {
        apiPost("/auth/refresh", {}).catch(() => null);
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  async function login(username: string, password: string) {
    const res = await apiPost<{ user: { id: string; username: string; roleCode: string } }>("/auth/login", {
      username,
      password,
    });
    await refreshUser();
    return {
      id: res.user.id,
      username: res.user.username,
      role_code: res.user.roleCode,
      linked_entity_type: null,
      linked_entity_id: null,
    };
  }

  async function logout() {
    await apiPost("/auth/logout", {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth يجب استخدامه داخل AuthProvider");
  return ctx;
}
