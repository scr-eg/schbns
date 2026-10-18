import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../lib/api";

interface Section { id: string; name: string; class_id: string; }
interface ClassItem { id: string; name_ar: string; grade_name: string; }
interface Subject { id: string; name_ar: string; }
interface Teacher { id: string; full_name: string; }
interface AcademicYear { id: string; name: string; is_current: number; }
interface Slot {
  id: string; day_of_week: number; period_index: number; room: string | null;
  subject_name: string; teacher_name: string; section_name: string; class_name: string;
}

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function TimetableAdminPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ subjectId: "", teacherId: "", dayOfWeek: "0", periodIndex: "1", room: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: ClassItem[] }>("/academic/classes").then((r) => setClasses(r.data));
    apiGet<{ data: Subject[] }>("/academic/subjects").then((r) => setSubjects(r.data));
    apiGet<{ data: Teacher[] }>("/teachers").then((r) => setTeachers(r.data));
    apiGet<{ data: AcademicYear[] }>("/academic/academic-years").then((r) => setYears(r.data));
  }, []);

  useEffect(() => {
    if (!selectedClassId) { setSections([]); return; }
    apiGet<{ data: Section[] }>(`/academic/sections?classId=${selectedClassId}`).then((r) => setSections(r.data));
  }, [selectedClassId]);

  async function loadSlots() {
    if (!selectedSectionId) return;
    const res = await apiGet<{ data: Slot[] }>(`/timetables?sectionId=${selectedSectionId}`);
    setSlots(res.data);
  }

  useEffect(() => { loadSlots(); }, [selectedSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentYear = years.find((y) => y.is_current === 1) ?? years[0];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentYear) { setError("لا توجد سنة دراسية حالية معرَّفة"); return; }
    try {
      await apiPost("/timetables", {
        sectionId: selectedSectionId,
        subjectId: form.subjectId,
        teacherId: form.teacherId,
        dayOfWeek: Number(form.dayOfWeek),
        periodIndex: Number(form.periodIndex),
        room: form.room || undefined,
        academicYearId: currentYear.id,
      });
      await loadSlots();
    } catch (err) {
      // ⚠️ هذه رسالة تعارض حقيقية قادمة من قيد قاعدة البيانات، وليست تحققًا شكليًا في الواجهة فقط
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function removeSlot(id: string) {
    await apiDelete(`/timetables/${id}`, "حذف حصة دراسية").catch(() => null);
    await loadSlots();
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">إدارة الجداول الدراسية</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClassId}
          onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSectionId(""); }}>
          <option value="">اختر الصف</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.grade_name} — {c.name_ar}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedSectionId}
          onChange={(e) => setSelectedSectionId(e.target.value)} disabled={!sections.length}>
          <option value="">اختر الفصل</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedSectionId && (
        <>
          <form onSubmit={handleAdd} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 md:grid-cols-5 max-w-3xl">
            <select required className="border rounded-lg px-3 py-2 text-sm" value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">المادة</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
            </select>
            <select required className="border rounded-lg px-3 py-2 text-sm" value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">المعلم</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <input type="number" min={1} max={10} className="border rounded-lg px-3 py-2 text-sm" placeholder="الحصة"
              value={form.periodIndex} onChange={(e) => setForm({ ...form, periodIndex: e.target.value })} />
            <button type="submit" className="py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: "var(--color-primary)" }}>
              إضافة
            </button>
          </form>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-sm min-w-[500px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-right p-3">اليوم</th>
                <th className="text-right p-3">الحصة</th>
                <th className="text-right p-3">المادة</th>
                <th className="text-right p-3">المعلم</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{DAYS[s.day_of_week]}</td>
                  <td className="p-3">{s.period_index}</td>
                  <td className="p-3">{s.subject_name}</td>
                  <td className="p-3">{s.teacher_name}</td>
                  <td className="p-3">
                    <button onClick={() => removeSlot(s.id)} className="text-xs underline text-red-600">حذف</button>
                  </td>
                </tr>
              ))}
              {slots.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">لا توجد حصص مضافة بعد</td></tr>
              )}
            </tbody>
          </table>
      </div>
        </>
      )}
    </div>
  );
}
