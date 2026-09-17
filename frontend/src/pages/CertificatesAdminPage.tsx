import { useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "../lib/api";

interface AcademicYear { id: string; name: string; is_current: number; }
interface StudentOption { id: string; student_code: string; full_name: string; }
interface IssueResult { id: string; verificationCode: string; downloadUrl: string; viewUrl: string; }

export default function CertificatesAdminPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [certificateType, setCertificateType] = useState<"result_certificate" | "transcript" | "success_certificate">("result_certificate");
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<IssueResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: AcademicYear[] }>("/academic/academic-years").then((r) => setYears(r.data));
  }, []);

  useEffect(() => {
    if (studentQuery.length < 2) { setStudentOptions([]); return; }
    const timeout = setTimeout(() => {
      apiGet<{ data: StudentOption[] }>(`/students?q=${encodeURIComponent(studentQuery)}`).then((r) => setStudentOptions(r.data));
    }, 300);
    return () => clearTimeout(timeout);
  }, [studentQuery]);

  const currentYear = years.find((y) => y.is_current === 1) ?? years[0];

  async function handleIssue() {
    if (!selectedStudent || !currentYear) return;

    // ⚠️ إصدار الشهادة يُنتج رابط PDF ورمز QR فوريين؛ قائمة الانتظار لا تناسب هذا الإجراء
    // لأن النتيجة (الرابط) لن تكون متاحة إلا بعد المزامنة الفعلية. لذا نمنعه بوضوح بدل تأجيله بصمت.
    if (!navigator.onLine) {
      setError("إصدار الشهادات يتطلب اتصالاً فعليًا بالإنترنت (لتوليد PDF عبر Google). حاول مجددًا عند عودة الاتصال.");
      return;
    }

    setIssuing(true);
    setError(null);
    setIssued(null);
    setQrDataUrl(null);
    try {
      const res = await apiPost<IssueResult>("/certificates/issue", {
        studentId: selectedStudent.id,
        academicYearId: currentYear.id,
        certificateType,
      });
      setIssued(res);

      const QRCode = await import("qrcode");
      const verifyUrl = `${window.location.origin}/verify/${res.verificationCode}`;
      const dataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حدث خطأ أثناء إصدار الشهادة");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">إصدار الشهادات</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">بحث عن الطالب (بالاسم أو الكود)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setSelectedStudent(null); }} />
          {studentOptions.length > 0 && !selectedStudent && (
            <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto text-sm">
              {studentOptions.map((s) => (
                <button key={s.id} onClick={() => { setSelectedStudent(s); setStudentQuery(s.full_name); setStudentOptions([]); }}
                  className="block w-full text-right px-3 py-2 hover:bg-gray-50">
                  {s.full_name} ({s.student_code})
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">نوع الشهادة</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={certificateType}
            onChange={(e) => setCertificateType(e.target.value as typeof certificateType)}>
            <option value="result_certificate">شهادة نتيجة</option>
            <option value="transcript">كشف درجات</option>
            <option value="success_certificate">شهادة نجاح</option>
          </select>
        </div>

        <p className="text-xs text-gray-400">
          سيتم إصدار الشهادة فقط من النتائج المنشورة أو المُقفلة لهذا الطالب في السنة الدراسية الحالية.
        </p>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button onClick={handleIssue} disabled={!selectedStudent || issuing}
          className="px-5 py-2 rounded-lg text-white text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}>
          {issuing ? "جارِ الإصدار عبر Google Docs..." : "إصدار الشهادة"}
        </button>

        {issued && (
          <div className="border-t pt-4 mt-4 flex items-center gap-4">
            <div>
              <p className="text-sm font-bold mb-1">تم الإصدار بنجاح</p>
              <p className="text-xs text-gray-500 mb-2">رمز التحقق: {issued.verificationCode}</p>
              <a href={issued.downloadUrl} target="_blank" rel="noreferrer" className="text-sm underline text-blue-700">
                تحميل PDF
              </a>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR للتحقق" className="w-24 h-24 border rounded-lg" />}
          </div>
        )}
      </div>
    </div>
  );
}
