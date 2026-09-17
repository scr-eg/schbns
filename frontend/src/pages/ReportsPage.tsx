import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

interface Exam { id: string; name: string; }
interface Stage { id: string; name_ar: string; }

type ReportType = "students" | "exam-results-summary" | "top-results";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("students");
  const [exams, setExams] = useState<Exam[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<{ data: Exam[] }>("/exams").then((r) => setExams(r.data));
    apiGet<{ data: Stage[] }>("/academic/stages").then((r) => setStages(r.data));
  }, []);

  function buildPath() {
    if (reportType === "students") return `/reports/students${selectedStageId ? `?stageId=${selectedStageId}` : ""}`;
    if (reportType === "exam-results-summary") return `/reports/exam-results-summary/${selectedExamId}`;
    return `/reports/top-results/${selectedExamId}`;
  }

  async function runReport() {
    if (reportType !== "students" && !selectedExamId) return;
    setLoading(true);
    try {
      const res = await apiGet<{ data: Record<string, unknown>[] }>(buildPath());
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const path = buildPath();
    const separator = path.includes("?") ? "&" : "?";
    window.open(`/api${path}${separator}format=csv`, "_blank");
  }

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">مركز التقارير</h1>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <select className="border rounded-lg px-3 py-2 text-sm" value={reportType}
          onChange={(e) => { setReportType(e.target.value as ReportType); setRows([]); }}>
          <option value="students">كشف الطلاب</option>
          <option value="exam-results-summary">ملخص نتائج امتحان</option>
          <option value="top-results">أفضل النتائج في امتحان</option>
        </select>

        {reportType === "students" && (
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}>
            <option value="">كل المراحل</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
          </select>
        )}

        {reportType !== "students" && (
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}>
            <option value="">اختر الامتحان</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}

        <button onClick={runReport} className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          {loading ? "جارِ التحميل..." : "عرض التقرير"}
        </button>

        {rows.length > 0 && (
          <>
            <button onClick={exportCsv} className="px-4 py-2 rounded-lg border text-sm">
              تصدير Excel (CSV)
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border text-sm">
              طباعة
            </button>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{columns.map((col) => <th key={col} className="text-right p-3">{col}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {columns.map((col) => <td key={col} className="p-3">{String(row[col] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
