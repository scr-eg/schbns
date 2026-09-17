import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet, apiPost, ApiError, OfflineQueuedError } from "../lib/api";

interface Component { id: string; component_name: string; max_score: number; }
interface StudentRow {
  student_id: string;
  student_code: string;
  full_name: string;
  workflowState: string | null;
  scores: Record<string, number>;
}

const STATE_LABEL: Record<string, string> = {
  draft: "مسودة", submitted: "مُرسَل", reviewed: "تمت المراجعة", approved: "معتمد", published: "منشور", locked: "مُقفل",
};

export default function GradeEntryPage() {
  const { examSubjectId } = useParams<{ examSubjectId: string }>();
  const [components, setComponents] = useState<Component[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!examSubjectId) return;
    const res = await apiGet<{ components: Component[]; students: StudentRow[] }>(
      `/results/exam-subject/${examSubjectId}/entry-sheet`
    );
    setComponents(res.components);
    setStudents(res.students);
  }

  useEffect(() => { load(); }, [examSubjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateScore(studentId: string, componentId: string, value: string) {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, scores: { ...s.scores, [componentId]: Number(value) } } : s))
    );
  }

  async function saveStudent(student: StudentRow) {
    if (!examSubjectId) return;
    setSavingId(student.student_id);
    setMessage(null);
    try {
      await apiPost("/results/entry", {
        examSubjectId,
        studentId: student.student_id,
        components: components.map((c) => ({ gradeComponentId: c.id, score: student.scores[c.id] ?? 0 })),
      });
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError || err instanceof OfflineQueuedError ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setSavingId(null);
    }
  }

  async function submitAll() {
    if (!examSubjectId) return;
    setMessage(null);
    try {
      const res = await apiPost<{ transitionedCount: number }>(`/results/exam-subject/${examSubjectId}/submit`, {});
      setMessage(`تم إرسال ${res.transitionedCount} نتيجة للمراجعة`);
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError || err instanceof OfflineQueuedError ? err.message : "حدث خطأ");
    }
  }

  if (components.length === 0) {
    return <p className="p-6 text-gray-400">لا توجد مكوّنات درجات مُعرَّفة لهذه المادة بعد.</p>;
  }

  return (
    <div className="p-6">
      <Link to="/dashboard" className="text-sm text-gray-500 underline">→ العودة</Link>
      <div className="flex justify-between items-center my-4">
        <h1 className="text-xl font-bold">إدخال الدرجات</h1>
        <button onClick={submitAll} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          إرسال كل الدرجات المكتملة للمراجعة
        </button>
      </div>

      {message && <p className="text-sm bg-white rounded-lg p-3 shadow-sm mb-4">{message}</p>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right p-3">الطالب</th>
              {components.map((c) => (
                <th key={c.id} className="text-right p-3">{c.component_name} (حتى {c.max_score})</th>
              ))}
              <th className="text-right p-3">الحالة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isLocked = s.workflowState && s.workflowState !== "draft";
              return (
                <tr key={s.student_id} className="border-t">
                  <td className="p-3">{s.full_name}</td>
                  {components.map((c) => (
                    <td key={c.id} className="p-3">
                      <input
                        type="number"
                        min={0}
                        max={c.max_score}
                        disabled={!!isLocked}
                        className="w-20 border rounded px-2 py-1 disabled:bg-gray-100"
                        value={s.scores[c.id] ?? ""}
                        onChange={(e) => updateScore(s.student_id, c.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-3 text-xs text-gray-500">
                    {s.workflowState ? STATE_LABEL[s.workflowState] : "لم تُدخَل"}
                  </td>
                  <td className="p-3">
                    {!isLocked && (
                      <button onClick={() => saveStudent(s)} disabled={savingId === s.student_id}
                        className="text-xs underline text-gray-600 disabled:opacity-50">
                        {savingId === s.student_id ? "جارِ الحفظ..." : "حفظ"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
