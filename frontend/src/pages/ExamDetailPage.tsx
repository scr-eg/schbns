import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet, apiPost, ApiError } from "../lib/api";

interface ExamDetail { id: string; name: string; status: string; }
interface ExamSubjectRow { id: string; subject_id: string; subject_name: string; max_score: number; pass_score: number; }
interface Subject { id: string; name_ar: string; }
interface ValidationIssue { studentId: string; studentName: string; message: string; }

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [subjects, setSubjects] = useState<ExamSubjectRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ subjectId: "", maxScore: "100", passScore: "50" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  async function load() {
    if (!id) return;
    const res = await apiGet<{ data: ExamDetail; subjects: ExamSubjectRow[] }>(`/exams/${id}`);
    setExam(res.data);
    setSubjects(res.subjects);
  }

  useEffect(() => {
    load();
    apiGet<{ data: Subject[] }>("/academic/subjects").then((r) => setAllSubjects(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost(`/exams/${id}/subjects`, {
        subjectId: form.subjectId,
        maxScore: Number(form.maxScore),
        passScore: Number(form.passScore),
      });
      setForm({ subjectId: "", maxScore: "100", passScore: "50" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function generateSeating() {
    setMessage(null);
    const res = await apiPost<{ createdCount: number; message?: string }>(`/exams/${id}/seating/generate`, {});
    setMessage(res.message ?? `تم توليد ${res.createdCount} رقم جلوس جديد`);
  }

  async function runTransition(examSubjectId: string, action: string) {
    setIssues([]);
    setMessage(null);
    try {
      const res = await apiPost<{ transitionedCount: number }>(`/results/exam-subject/${examSubjectId}/${action}`, {});
      setMessage(`تم تنفيذ "${action}" على ${res.transitionedCount} نتيجة`);
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(err.message);
        const details = err.details as { issues?: ValidationIssue[] } | undefined;
        if (details?.issues) setIssues(details.issues);
      } else if (err instanceof Error) {
        setMessage(err.message);
      }
    }
  }

  if (!exam) return <div className="p-6 text-gray-400">جارِ التحميل...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <Link to="/admin/exams" className="text-sm text-gray-500 underline">→ كل الامتحانات</Link>
      <h1 className="text-xl font-bold my-4">{exam.name}</h1>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h2 className="font-bold mb-3">مواد الامتحان</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm mb-4 min-w-[600px]">
          <thead className="text-gray-500">
            <tr><th className="text-right py-1">المادة</th><th className="text-right py-1">الدرجة النهائية</th><th className="text-right py-1">درجة النجاح</th><th></th></tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2">{s.subject_name}</td>
                <td className="py-2">{s.max_score}</td>
                <td className="py-2">{s.pass_score}</td>
                <td className="py-2 flex gap-2 flex-wrap text-xs">
                  <Link to={`/teacher/grades/${s.id}`} className="underline text-gray-600">إدخال/عرض الدرجات</Link>
                  <button onClick={() => runTransition(s.id, "review")} className="underline text-blue-600">مراجعة</button>
                  <button onClick={() => runTransition(s.id, "approve")} className="underline text-green-700">اعتماد</button>
                  <button onClick={() => runTransition(s.id, "publish")} className="underline text-purple-700">نشر</button>
                  <button onClick={() => runTransition(s.id, "lock")} className="underline text-red-700">قفل نهائي</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <form onSubmit={addSubject} className="grid grid-cols-1 sm:grid-cols-4 gap-2 max-w-lg">
          <select required className="border rounded-lg px-2 py-1 text-sm sm:col-span-2" value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            <option value="">إضافة مادة...</option>
            {allSubjects.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
          </select>
          <input type="number" className="border rounded-lg px-2 py-1 text-sm" placeholder="الدرجة النهائية"
            value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
          <input type="number" className="border rounded-lg px-2 py-1 text-sm" placeholder="درجة النجاح"
            value={form.passScore} onChange={(e) => setForm({ ...form, passScore: e.target.value })} />
          <button type="submit" className="sm:col-span-4 py-1.5 rounded-lg text-white text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}>
            إضافة المادة
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-bold mb-3">أرقام الجلوس</h2>
        <button onClick={generateSeating} className="px-4 py-2 rounded-lg border text-sm">
          توليد أرقام الجلوس تلقائيًا لكل طلاب الصف
        </button>
      </div>

      {message && <p className="text-sm mt-4 bg-white rounded-lg p-3 shadow-sm">{message}</p>}

      {issues.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <p className="font-bold text-red-700 mb-2">يجب حل المشكلات التالية قبل الاعتماد:</p>
          <ul className="space-y-1">
            {issues.map((iss, i) => (
              <li key={i} className="text-red-700">• {iss.studentName}: {iss.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
