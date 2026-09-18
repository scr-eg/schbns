import { useEffect, useState } from "react";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface SchoolSettings {
  address: string | null;
  phone: string | null;
  email: string | null;
}

export default function ContactPage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    apiGet<{ data: SchoolSettings }>("/settings").then((res) => setSettings(res.data));
  }, []);

  return (
    <PublicLayout>
      <section className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-6">تواصل معنا</h1>
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-3 text-sm">
          <Row label="العنوان" value={settings?.address} />
          <Row label="الهاتف" value={settings?.phone} />
          <Row label="البريد الإلكتروني" value={settings?.email} />
        </div>
        <p className="text-xs text-gray-400 mt-4">
          نموذج تواصل مباشر (Contact Form) سيُضاف في مرحلة لاحقة مع نظام الرسائل الداخلي.
        </p>
      </section>
    </PublicLayout>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
