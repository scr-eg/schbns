import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

// توجيه كل دور إلى لوحته المخصصة (تُستكمل باقي المسارات في Phases القادمة)
const ROLE_HOME: Record<string, string> = {
  super_admin: "/dashboard",
  school_admin: "/dashboard",
  exam_controller: "/dashboard",
  teacher: "/dashboard",
  student: "/dashboard",
  parent: "/dashboard",
};

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(ROLE_HOME[user.role_code] ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.error_invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow-md rounded-xl p-8">
        <div className="flex justify-end mb-4">
          <button
            className="text-sm text-gray-500 underline"
            onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
          >
            {i18n.language === "ar" ? "English" : "العربية"}
          </button>
        </div>

        <h1 className="text-xl font-bold text-center mb-6" style={{ color: "var(--color-primary)" }}>
          {t("login.title")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">{t("login.username")}</label>
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">{t("login.password")}</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? "..." : t("login.submit")}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="text-sm text-gray-500 underline">
            {t("login.forgot_password")}
          </Link>
        </div>
      </div>
    </div>
  );
}
