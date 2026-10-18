import { useEffect, useState } from "react";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface SchoolSettings {
  school_name_ar: string;
  ministry: string | null;
  education_department: string | null;
  governorate: string | null;
  founded_year: number | null;
}

export default function AboutPage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    apiGet<{ data: SchoolSettings }>("/settings").then((res) => setSettings(res.data));
  }, []);

  return (
    <PublicLayout>
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-4">عن المدرسة</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          {settings?.school_name_ar} مدرسة تُعنى بتقديم تعليم متميز لطلابها عبر المراحل
          الابتدائية والإعدادية والثانوية، وتحرص على بناء بيئة تعليمية آمنة ومحفّزة.
          (هذا النص الافتراضي قابل للتعديل الكامل من لوحة الإدارة دون الحاجة لتعديل الكود).
        </p>

        <div className="grid md:grid-cols-2 gap-4 bg-white rounded-xl shadow-sm p-6 text-sm">
          <Info label="الجهة التابعة" value={settings?.ministry} />
          <Info label="الإدارة التعليمية" value={settings?.education_department} />
          <Info label="المحافظة" value={settings?.governorate} />
          <Info label="سنة التأسيس" value={settings?.founded_year?.toString()} />
        </div>
      </section>
    </PublicLayout>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
