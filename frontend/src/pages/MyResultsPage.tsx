import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { apiGet } from "../lib/api";

interface ResultRow {
  id: string;
  subject_name: string;
  total_score: number | null;
  percentage: number | null;
  grade_letter: string | null;
  status: "pass" | "fail" | null;
  exam_name: string;
  term_name: string;
}

interface Child {
  id: string;
  student_code: string;
  full_name: string;
}

interface Certificate {
  id: string;
  certificate_type: string;
  verification_code: string;
  view_url: string;
  issued_at: string;
}

const CERT_TYPE_LABEL: Record<string, string> = {
  result_certificate: "شهادة نتيجة", transcript: "كشف درجات", success_certificate: "شهادة نجاح",
};

export default function MyResultsPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role_code === "student") {
      setSelectedStudentId(user.linked_entity_id);
      setLoading(false);
    } else if (user.role_code === "parent") {
      apiGet<{ data: Child[] }>("/parents/my-children").then((r) => {
        setChildren(r.data);
        if (r.data[0]) setSelectedStudentId(r.data[0].id);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedStudentId) return;
    apiGet<{ data: ResultRow[] }>(`/results/student/${selectedStudentId}`).then((r) => setResults(r.data));
    apiGet<{ data: Certificate[] }>(`/certificates/student/${selectedStudentId}`).then((r) => setCertificates(r.data));
  }, [selectedStudentId]);

  if (loading) return <div className="p-6 text-gray-400">جارِ التحميل...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">النتائج</h1>

      {user?.role_code === "parent" && children.length > 1 && (
        <select className="border rounded-lg px-3 py-2 text-sm mb-4"
          value={selectedStudentId ?? ""} onChange={(e) => setSelectedStudentId(e.target.value)}>
          {children.map((ch) => <option key={ch.id} value={ch.id}>{ch.full_name}</option>)}
        </select>
      )}

      {results.length === 0 && <p className="text-gray-400">لا توجد نتائج منشورة بعد.</p>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right p-3">الامتحان</th>
              <th className="text-right p-3">المادة</th>
              <th className="text-right p-3">الدرجة</th>
              <th className="text-right p-3">النسبة</th>
              <th className="text-right p-3">التقدير</th>
              <th className="text-right p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.exam_name}</td>
                <td className="p-3">{r.subject_name}</td>
                <td className="p-3">{r.total_score ?? "—"}</td>
                <td className="p-3">{r.percentage ? `${r.percentage.toFixed(1)}%` : "—"}</td>
                <td className="p-3">{r.grade_letter ?? "—"}</td>
                <td className="p-3">
                  {r.status === "pass" && <span className="text-green-700">ناجح</span>}
                  {r.status === "fail" && <span className="text-red-600">له دور ثانٍ</span>}
                  {!r.status && "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {certificates.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-sm mb-3">الشهادات الصادرة</h2>
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {certificates.map((cert) => (
              <div key={cert.id} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <p>{CERT_TYPE_LABEL[cert.certificate_type] ?? cert.certificate_type}</p>
                  <p className="text-xs text-gray-400">رمز التحقق: {cert.verification_code}</p>
                </div>
                <a href={cert.view_url} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700">
                  عرض/تحميل
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
