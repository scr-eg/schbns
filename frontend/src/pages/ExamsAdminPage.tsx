import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

interface Exam { id: string; name: string; status: string; exam_type_name: string; grade_name: string; term_name: string; }
interface ExamType { id: string; name_ar: string; }
interface Grade { id: string; name_ar: string; }
interface AcademicYear { id: string; name: string; is_current: number; }
interface Term { id: string; name: string; academic_year_id: string; }

export default function ExamsAdminPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", examTypeId: "", gradeId: "", termId: "" });
  const [error, setError] = useState<string | null>(null);

  async function loadExams() {
    const res = await apiGet<{ data: Exam[] }>("/exams");
    setExams(res.data);
  }

  useEffect(() => {
    loadExams();
    apiGet<{ data: ExamType[] }>("/exams/types").then((r) => setExamTypes(r.data));
    apiGet<{ data: Grade[] }>("/academic/grades").then((r) => setGrades(r.data));
    apiGet<{ data: AcademicYear[] }>("/academic/academic-years").then((r) => setYears(r.data));
    apiGet<{ data: Term[] }>("/academic/terms").then((r) => setTerms(r.data));
  }, []);

  const currentYear = years.find((y) => y.is_current === 1) ?? years[0];
  const currentYearTerms = terms.filter((t) => t.academic_year_id === currentYear?.id);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentYear) { setError("لا توجد سنة دراسية حالية"); return; }
    try {
      await apiPost("/exams", { ...form, academicYearId: currentYear.id });
      setShowForm(false);
      setForm({ name: "", examTypeId: "", gradeId: "", termId: "" });
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">إدارة الامتحانات</h1>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          + امتحان جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 max-w-lg">
          <input required placeholder="اسم الامتحان" className="border rounded-lg px-3 py-2"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select required className="border rounded-lg px-3 py-2" value={form.examTypeId}
            onChange={(e) => setForm({ ...form, examTypeId: e.target.value })}>
            <option value="">نوع الامتحان</option>
            {examTypes.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
          </select>
          <select required className="border rounded-lg px-3 py-2" value={form.gradeId}
            onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
            <option value="">الصف</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
          </select>
          <select required className="border rounded-lg px-3 py-2" value={form.termId}
            onChange={(e) => setForm({ ...form, termId: e.target.value })}>
            <option value="">الترم</option>
            {currentYearTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
            <th className="text-right p-3">اسم الامتحان</th>
            <th className="text-right p-3">النوع</th>
            <th className="text-right p-3">الصف</th>
            <th className="text-right p-3">الحالة</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {exams.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-3">{e.name}</td>
              <td className="p-3 text-gray-400">{e.exam_type_name}</td>
              <td className="p-3 text-gray-400">{e.grade_name}</td>
              <td className="p-3">{e.status}</td>
              <td className="p-3">
                <Link to={`/admin/exams/${e.id}`} className="text-xs underline text-gray-600">إدارة</Link>
              </td>
            </tr>
          ))}
          {exams.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">لا توجد امتحانات بعد</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
