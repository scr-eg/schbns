import { useState } from "react";
import { apiPost } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email });
    } finally {
      setLoading(false);
      setSent(true); // نُظهر نفس الرسالة دائمًا لمنع كشف وجود البريد من عدمه
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow-md rounded-xl p-8">
        <h1 className="text-lg font-bold mb-4 text-center">استعادة كلمة المرور</h1>
        {sent ? (
          <p className="text-sm text-gray-600 text-center">
            إذا كان البريد الإلكتروني مسجّلاً لدينا، فستصلك رسالة تحتوي رابط إعادة تعيين كلمة المرور خلال دقائق.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                className="w-full border rounded-lg px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {loading ? "..." : "إرسال رابط الاستعادة"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
