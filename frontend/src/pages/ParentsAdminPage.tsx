import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

interface ParentRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface Child {
  id: string;
  student_code: string;
  full_name: string;
  relationship: string;
}

export default function ParentsAdminPage() {
  const [parentsList, setParentsList] = useState<ParentRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [linkStudentCode, setLinkStudentCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await apiGet<{ data: ParentRow[] }>(`/parents${params}`);
    setParentsList(res.data);
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
      await apiPost("/parents", form);
      setShowForm(false);
      setForm({ fullName: "", phone: "", email: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function toggleExpand(parent: ParentRow) {
    if (expandedId === parent.id) {
      setExpandedId(null);
      return;
    }
    const res = await apiGet<{ children: Child[] }>(`/parents/${parent.id}`);
    setChildren(res.children);
    setExpandedId(parent.id);
  }

  async function linkChild(parentId: string) {
    if (!linkStudentCode) return;
    setError(null);
    try {
      // 1) البحث عن الطالب بالكود للحصول على studentId الفعلي
      const searchRes = await apiGet<{ data: { id: string; student_code: string }[] }>(
        `/students?q=${encodeURIComponent(linkStudentCode)}`
      );
      const match = searchRes.data.find((s) => s.student_code === linkStudentCode);
      if (!match) {
        setError(`لا يوجد طالب بالكود "${linkStudentCode}"`);
        return;
      }
      // 2) الربط الفعلي
      await apiPost(`/parents/${parentId}/link-student`, { studentId: match.id, relationship: "guardian" });
      setLinkStudentCode("");
      const refreshed = await apiGet<{ children: Child[] }>(`/parents/${parentId}`);
      setChildren(refreshed.children);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الربط");
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">إدارة أولياء الأمور</h1>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          + ولي أمر جديد
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden text-sm">
        {parentsList.map((p) => (
          <div key={p.id} className="border-t first:border-t-0">
            <div className="flex justify-between items-center p-3">
              <div>
                <p className="font-medium">{p.full_name}</p>
                <p className="text-gray-400 text-xs">{p.phone} {p.email && `— ${p.email}`}</p>
              </div>
              <button onClick={() => toggleExpand(p)} className="text-xs underline text-gray-500">
                {expandedId === p.id ? "إخفاء الأبناء" : "عرض الأبناء"}
              </button>
            </div>
            {expandedId === p.id && (
              <div className="bg-gray-50 p-3 text-xs">
                {children.length === 0 && <p className="text-gray-400">لا يوجد أبناء مرتبطون بعد.</p>}
                <ul className="space-y-1 mb-2">
                  {children.map((ch) => (
                    <li key={ch.id}>• {ch.full_name} ({ch.student_code}) — {ch.relationship}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input placeholder="كود الطالب لربطه" className="border rounded px-2 py-1 flex-1"
                    value={linkStudentCode} onChange={(e) => setLinkStudentCode(e.target.value)} />
                  <button onClick={() => linkChild(p.id)} className="px-3 py-1 rounded border">ربط</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {parentsList.length === 0 && <p className="p-6 text-center text-gray-400">لا توجد نتائج</p>}
      </div>
    </div>
  );
}
