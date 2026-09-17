import { useState } from "react";
import { apiPost } from "../lib/api";

interface RawRow {
  [key: string]: unknown;
}

interface ValidationResult {
  rowIndex: number;
  status: "valid" | "error";
  errors?: string[];
  data?: { studentCode: string; fullName: string; gender?: string; birthDate?: string };
}

// تطابق أعمدة ملف Excel (بالعربية أو الإنجليزية) مع حقول النظام
const COLUMN_ALIASES: Record<string, string> = {
  "كود الطالب": "studentCode", "Student Code": "studentCode", "student_code": "studentCode",
  "الاسم": "fullName", "اسم الطالب": "fullName", "Student Name": "fullName", "full_name": "fullName",
  "الرقم القومي": "nationalId", "National ID": "nationalId",
  "النوع": "gender", "الجنس": "gender", "Gender": "gender",
  "تاريخ الميلاد": "birthDate", "Birth Date": "birthDate",
  "اسم ولي الأمر": "parentName", "Parent Name": "parentName",
  "هاتف ولي الأمر": "parentPhone", "Parent Phone": "parentPhone",
};

function normalizeRows(rawRows: RawRow[]) {
  return rawRows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const mappedKey = COLUMN_ALIASES[key.trim()] ?? key.trim();
      normalized[mappedKey] = typeof value === "string" ? value.trim() : value;
    }
    if (normalized.gender === "ذكر") normalized.gender = "male";
    if (normalized.gender === "أنثى") normalized.gender = "female";
    return normalized;
  });
}

export default function StudentsImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [validation, setValidation] = useState<ValidationResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; validCount: number; errorCount: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidation(null);
    setImportedCount(null);
    setError(null);

    const buffer = await file.arrayBuffer();
    const XLSX = await import("xlsx"); // تحميل ديناميكي: يقلل حجم الحزمة الرئيسية لأن xlsx مكتبة كبيرة
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<RawRow>(firstSheet);
    const normalized = normalizeRows(rawRows);
    setRows(normalized);
  }

  async function handleValidate() {
    setError(null);
    try {
      const res = await apiPost<{ results: ValidationResult[]; summary: typeof summary }>(
        "/import/students/validate",
        { rows }
      );
      setValidation(res.results);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التحقق");
    }
  }

  async function handleCommit() {
    if (!summary || summary.errorCount > 0) return;
    setImporting(true);
    setError(null);
    try {
      const validRows = rows; // أُعيد التحقق من جهة السيرفر مرة أخرى قبل الإدراج فعليًا
      const res = await apiPost<{ importedCount: number }>("/import/students/commit", { rows: validRows });
      setImportedCount(res.importedCount);
      setValidation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاستيراد، لم يتم حفظ أي بيانات");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold mb-2">استيراد الطلاب من Excel</h1>
      <p className="text-sm text-gray-500 mb-6">
        الأعمدة المتوقعة: كود الطالب، الاسم، النوع (اختياري)، تاريخ الميلاد (اختياري).
        لن يُحفظ أي شيء في قاعدة البيانات قبل مراجعتك للنتائج والضغط على "تأكيد الاستيراد".
      </p>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />

        {fileName && (
          <p className="text-sm text-gray-500">
            الملف: {fileName} — {rows.length} صف تم تحليله محليًا.
          </p>
        )}

        {rows.length > 0 && !validation && (
          <button onClick={handleValidate} className="px-5 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}>
            التحقق من البيانات (Preview)
          </button>
        )}

        {summary && (
          <div className="text-sm">
            <p className="mb-2">
              الإجمالي: {summary.total} — صحيح: <span className="text-green-700">{summary.validCount}</span> —
              أخطاء: <span className="text-red-600">{summary.errorCount}</span>
            </p>

            <div className="max-h-64 overflow-auto border rounded-lg">
              <table className="w-full text-xs min-w-[400px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-right">الصف</th>
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {validation?.map((r) => (
                    <tr key={r.rowIndex} className="border-t">
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2">
                        {r.status === "valid"
                          ? <span className="text-green-700">صالح</span>
                          : <span className="text-red-600">خطأ</span>}
                      </td>
                      <td className="p-2">
                        {r.status === "valid" ? r.data?.fullName : r.errors?.join("، ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.errorCount > 0 && (
              <p className="text-red-600 text-sm mt-2">
                يجب إصلاح كل الأخطاء في ملف Excel وإعادة رفعه؛ لن يُسمح بالاستيراد الجزئي لتفادي بيانات غير متسقة.
              </p>
            )}

            {summary.errorCount === 0 && (
              <button onClick={handleCommit} disabled={importing}
                className="mt-3 px-5 py-2 rounded-lg text-white text-sm disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary)" }}>
                {importing ? "جارِ الاستيراد..." : `تأكيد الاستيراد (${summary.validCount} طالب)`}
              </button>
            )}
          </div>
        )}

        {importedCount !== null && (
          <p className="text-green-700 text-sm">تم استيراد {importedCount} طالب بنجاح.</p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
}
