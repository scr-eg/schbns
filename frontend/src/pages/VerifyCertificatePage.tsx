import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface CertificateInfo {
  certificate_type: string;
  issued_at: string;
  full_name: string;
  student_code: string;
  academic_year: string;
}

const TYPE_LABEL: Record<string, string> = {
  result_certificate: "شهادة نتيجة", transcript: "كشف درجات", success_certificate: "شهادة نجاح",
};

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [certificate, setCertificate] = useState<CertificateInfo | null>(null);

  useEffect(() => {
    if (!code) return;
    apiGet<{ valid: boolean; certificate: CertificateInfo }>(`/certificates/verify/${code}`)
      .then((res) => {
        setCertificate(res.certificate);
        setStatus("valid");
      })
      .catch(() => setStatus("invalid"));
  }, [code]);

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        {status === "loading" && <p className="text-gray-400">جارِ التحقق...</p>}

        {status === "invalid" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-700 font-bold text-lg mb-1">✕ رمز غير صحيح</p>
            <p className="text-sm text-red-600">لم يتم العثور على شهادة بهذا الرمز.</p>
          </div>
        )}

        {status === "valid" && certificate && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-right">
            <p className="text-green-700 font-bold text-lg mb-4 text-center">✓ شهادة صحيحة وموثّقة</p>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">الطالب:</span> {certificate.full_name}</p>
              <p><span className="text-gray-500">كود الطالب:</span> {certificate.student_code}</p>
              <p><span className="text-gray-500">نوع الشهادة:</span> {TYPE_LABEL[certificate.certificate_type]}</p>
              <p><span className="text-gray-500">العام الدراسي:</span> {certificate.academic_year}</p>
              <p><span className="text-gray-500">تاريخ الإصدار:</span> {new Date(certificate.issued_at).toLocaleDateString("ar-EG")}</p>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
