import { useEffect, useState } from "react";
import { apiGet, apiPut, OfflineQueuedError } from "../lib/api";

interface SchoolSettings {
  school_name_ar: string;
  school_name_en: string | null;
  governorate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  primary_color: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: SchoolSettings }>("/settings").then((res) => setSettings(res.data));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPut("/settings", {
        schoolNameAr: settings.school_name_ar,
        schoolNameEn: settings.school_name_en ?? undefined,
        governorate: settings.governorate ?? undefined,
        address: settings.address ?? undefined,
        phone: settings.phone ?? undefined,
        email: settings.email ?? undefined,
        primaryColor: settings.primary_color,
      }, "تحديث إعدادات المدرسة");
      setMessage("تم حفظ الإعدادات بنجاح");
    } catch (err) {
      if (err instanceof OfflineQueuedError) setMessage(err.message);
      else setMessage(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="p-6 text-gray-400">جارِ التحميل...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">إعدادات المدرسة</h1>
      <form onSubmit={handleSave} className="space-y-4 bg-white p-6 rounded-xl shadow-sm">
        <Field label="اسم المدرسة (عربي)" value={settings.school_name_ar}
          onChange={(v) => setSettings({ ...settings, school_name_ar: v })} required />
        <Field label="اسم المدرسة (إنجليزي)" value={settings.school_name_en ?? ""}
          onChange={(v) => setSettings({ ...settings, school_name_en: v })} />
        <Field label="المحافظة" value={settings.governorate ?? ""}
          onChange={(v) => setSettings({ ...settings, governorate: v })} />
        <Field label="العنوان" value={settings.address ?? ""}
          onChange={(v) => setSettings({ ...settings, address: v })} />
        <Field label="الهاتف" value={settings.phone ?? ""}
          onChange={(v) => setSettings({ ...settings, phone: v })} />
        <Field label="البريد الإلكتروني" value={settings.email ?? ""}
          onChange={(v) => setSettings({ ...settings, email: v })} />
        <div>
          <label className="block text-sm mb-1">اللون الأساسي للنظام</label>
          <input type="color" value={settings.primary_color}
            onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} />
        </div>

        {message && <p className="text-sm text-green-700">{message}</p>}

        <button type="submit" disabled={saving}
          className="px-5 py-2 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}>
          {saving ? "جارِ الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        className="w-full border rounded-lg px-3 py-2"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
