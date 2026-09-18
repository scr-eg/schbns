import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

interface TeacherSubject {
  id: string;
  subject_id: string;
  subject_name: string;
  section_id: string;
  section_name: string;
  class_name: string;
}

interface RosterEntry {
  student_id: string;
  student_code: string;
  full_name: string;
  status: "present" | "absent" | "late" | "excused" | null;
}

const STATUS_OPTIONS: { value: RosterEntry["status"]; label: string; color: string }[] = [
  { value: "present", label: "حاضر", color: "bg-green-100 text-green-700" },
  { value: "late", label: "متأخر", color: "bg-amber-100 text-amber-700" },
  { value: "excused", label: "غياب بعذر", color: "bg-blue-100 text-blue-700" },
  { value: "absent", label: "غائب", color: "bg-red-100 text-red-700" },
];

export default function TeacherAttendancePage() {
  const [mySubjects, setMySubjects] = useState<TeacherSubject[]>([]);
  const [selected, setSelected] = useState<TeacherSubject | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodIndex, setPeriodIndex] = useState("1");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: TeacherSubject[] }>("/teachers/me/subjects").then((r) => {
      setMySubjects(r.data);
      if (r.data[0]) setSelected(r.data[0]);
    });
  }, []);

  async function loadRoster() {
    if (!selected) return;
    setMessage(null);
    const res = await apiGet<{ data: RosterEntry[] }>(
      `/attendance/roster?sectionId=${selected.section_id}&date=${date}&periodIndex=${periodIndex}`
    );
    setRoster(res.data.map((r) => ({ ...r, status: r.status ?? "present" })));
  }

  useEffect(() => { loadRoster(); }, [selected, date, periodIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function setStatus(studentId: string, status: RosterEntry["status"]) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)));
  }

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPost("/attendance/bulk", {
        sectionId: selected.section_id,
        date,
        periodIndex: Number(periodIndex),
        subjectId: selected.subject_id,
        records: roster.map((r) => ({ studentId: r.student_id, status: r.status })),
      });
      setMessage("تم حفظ الحضور بنجاح");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (mySubjects.length === 0) {
    return <p className="p-6 text-gray-400">لا توجد فصول مُكلَّف بتدريسها حاليًا.</p>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold mb-6">تسجيل الحضور</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <select className="border rounded-lg px-3 py-2 text-sm"
          value={selected?.id ?? ""}
          onChange={(e) => setSelected(mySubjects.find((s) => s.id === e.target.value) ?? null)}>
          {mySubjects.map((s) => (
            <option key={s.id} value={s.id}>{s.class_name} — {s.section_name} — {s.subject_name}</option>
          ))}
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={date}
          onChange={(e) => setDate(e.target.value)} />
        <input type="number" min={1} max={10} className="border rounded-lg px-3 py-2 text-sm w-24" value={periodIndex}
          onChange={(e) => setPeriodIndex(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {roster.map((r) => (
          <div key={r.student_id} className="flex items-center justify-between border-t first:border-t-0 p-3 text-sm">
            <span>{r.full_name} <span className="text-gray-400 text-xs">({r.student_code})</span></span>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(r.student_id, opt.value)}
                  className={`px-2 py-1 rounded text-xs ${r.status === opt.value ? opt.color : "bg-gray-50 text-gray-400"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {roster.length === 0 && <p className="p-6 text-center text-gray-400">لا يوجد طلاب مسجَّلون في هذا الفصل</p>}
      </div>

      {roster.length > 0 && (
        <button onClick={handleSubmit} disabled={saving}
          className="mt-4 px-5 py-2 rounded-lg text-white text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}>
          {saving ? "جارِ الحفظ..." : "حفظ الحضور"}
        </button>
      )}
      {message && <p className="text-sm mt-2 text-green-700">{message}</p>}
    </div>
  );
}
