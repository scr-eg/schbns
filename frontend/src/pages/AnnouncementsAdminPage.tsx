import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";

interface AnnouncementRow {
  id: string;
  title: string;
  audience: string;
  status: "draft" | "published" | "scheduled" | "archived";
  publish_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", published: "منشور", scheduled: "مجدول", archived: "مؤرشف",
};

export default function AnnouncementsAdminPage() {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", status: "draft" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiGet<{ data: AnnouncementRow[] }>("/announcements/admin/all");
    setItems(res.data);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost("/announcements/admin", form);
      setShowForm(false);
      setForm({ title: "", body: "", audience: "all", status: "draft" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function updateStatus(id: string, status: string) {
    await apiPatch(`/announcements/admin/${id}`, { status }, "تحديث حالة إعلان").catch(() => null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
    await apiDelete(`/announcements/admin/${id}`, "حذف إعلان").catch(() => null);
    await load();
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">إدارة الأخبار والإعلانات</h1>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          + إعلان جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 max-w-lg">
          <input required placeholder="العنوان" className="border rounded-lg px-3 py-2"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea required placeholder="النص" rows={4} className="border rounded-lg px-3 py-2"
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="border rounded-lg px-3 py-2" value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">الجميع</option>
              <option value="students">الطلاب</option>
              <option value="parents">أولياء الأمور</option>
              <option value="teachers">المعلمون</option>
              <option value="staff">العاملون</option>
            </select>
            <select className="border rounded-lg px-3 py-2" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">حفظ كمسودة</option>
              <option value="published">نشر فورًا</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="py-2 rounded-lg text-white" style={{ backgroundColor: "var(--color-primary)" }}>
            حفظ
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-sm min-w-[500px]">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-right p-3">العنوان</th>
            <th className="text-right p-3">الفئة</th>
            <th className="text-right p-3">الحالة</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-3">{a.title}</td>
              <td className="p-3 text-gray-400">{a.audience}</td>
              <td className="p-3">{STATUS_LABEL[a.status]}</td>
              <td className="p-3 flex gap-2 text-xs">
                {a.status !== "published" && (
                  <button onClick={() => updateStatus(a.id, "published")} className="underline text-green-700">نشر</button>
                )}
                {a.status === "published" && (
                  <button onClick={() => updateStatus(a.id, "archived")} className="underline text-gray-500">أرشفة</button>
                )}
                <button onClick={() => remove(a.id)} className="underline text-red-600">حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
