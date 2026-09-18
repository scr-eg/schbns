import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

interface TeacherRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

export default function TeachersAdminPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await apiGet<{ data: TeacherRow[] }>(`/teachers${params}`);
    setTeachers(res.data);
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost("/teachers", form);
      setShowForm(false);
      setForm({ fullName: "", phone: "", email: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">إدارة المعلمين</h1>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          + معلم جديد
        </button>
      </div>

      <input placeholder="بحث بالاسم..." className="border rounded-lg px-3 py-2 text-sm mb-4 w-full max-w-sm"
        value={search} onChange={(e) => setSearch(e.target.value)} />

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 max-w-md">
          <input required placeholder="الاسم الكامل" className="border rounded-lg px-3 py-2"
            value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input placeholder="الهاتف" className="border rounded-lg px-3 py-2"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="email" placeholder="البريد الإلكتروني" className="border rounded-lg px-3 py-2"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="py-2 rounded-lg text-white" style={{ backgroundColor: "var(--color-primary)" }}>
            إنشاء
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-sm min-w-[500px]">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-right p-3">الاسم</th>
            <th className="text-right p-3">الهاتف</th>
            <th className="text-right p-3">البريد الإلكتروني</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-3">{t.full_name}</td>
              <td className="p-3 text-gray-400">{t.phone ?? "—"}</td>
              <td className="p-3 text-gray-400">{t.email ?? "—"}</td>
            </tr>
          ))}
          {teachers.length === 0 && (
            <tr><td colSpan={3} className="p-6 text-center text-gray-400">لا توجد نتائج</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
