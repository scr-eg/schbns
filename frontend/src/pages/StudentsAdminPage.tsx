import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

interface StudentRow {
  id: string;
  student_code: string;
  full_name: string;
  status: string;
  stage_name: string | null;
}

interface Stage {
  id: string;
  name_ar: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: "مستجد", enrolled: "مقيّد", transferred_in: "منقول (وارد)", transferred_out: "منقول (صادر)",
  passed: "ناجح", failed: "راسب", expelled: "مفصول", graduated: "متخرج",
};

export default function StudentsAdminPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentCode: "", fullName: "", gender: "male", currentStageId: "" });
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (stageFilter) params.set("stageId", stageFilter);
    const res = await apiGet<{ data: StudentRow[]; total: number }>(`/students?${params.toString()}`);
    setStudents(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    apiGet<{ data: Stage[] }>("/academic/stages").then((res) => setStages(res.data));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 300); // debounce بسيط للبحث
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, stageFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost("/students", { ...form, currentStageId: form.currentStageId || undefined });
      setShowForm(false);
      setForm({ studentCode: "", fullName: "", gender: "male", currentStageId: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold">إدارة الطلاب ({total})</h1>
        <div className="flex gap-2">
          <Link to="/admin/students/import" className="px-4 py-2 rounded-lg border text-sm">
            استيراد من Excel
          </Link>
          <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}>
            + طالب جديد
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input placeholder="بحث بالاسم أو الكود..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">كل المراحل</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 max-w-md">
          <input required placeholder="كود الطالب" className="border rounded-lg px-3 py-2"
            value={form.studentCode} onChange={(e) => setForm({ ...form, studentCode: e.target.value })} />
          <input required placeholder="الاسم الكامل" className="border rounded-lg px-3 py-2"
            value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <select className="border rounded-lg px-3 py-2" value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
          <select className="border rounded-lg px-3 py-2" value={form.currentStageId}
            onChange={(e) => setForm({ ...form, currentStageId: e.target.value })}>
            <option value="">اختر المرحلة</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
          </select>
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
            <th className="text-right p-3">الكود</th>
            <th className="text-right p-3">الاسم</th>
            <th className="text-right p-3">المرحلة</th>
            <th className="text-right p-3">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-3">{s.student_code}</td>
              <td className="p-3">{s.full_name}</td>
              <td className="p-3 text-gray-400">{s.stage_name ?? "—"}</td>
              <td className="p-3">{STATUS_LABEL[s.status] ?? s.status}</td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr><td colSpan={4} className="p-6 text-center text-gray-400">لا توجد نتائج مطابقة</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
