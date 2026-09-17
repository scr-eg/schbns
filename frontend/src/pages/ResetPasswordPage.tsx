import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiPost } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const userId = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/reset-password", { userId, token, newPassword });
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  if (!userId || !token) {
    return <p className="p-10 text-center text-red-600">رابط غير صالح.</p>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow-md rounded-xl p-8">
        <h1 className="text-lg font-bold mb-4 text-center">تعيين كلمة مرور جديدة</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">كلمة المرور الجديدة</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full border rounded-lg px-3 py-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">8 أحرف على الأقل، تحتوي حرفًا ورقمًا.</p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? "..." : "حفظ كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}
