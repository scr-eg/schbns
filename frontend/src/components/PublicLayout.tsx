import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiGet } from "../lib/api";

interface SchoolSettings {
  school_name_ar: string;
  school_name_en: string | null;
  governorate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

const NAV_ITEMS: { key: string; path: string }[] = [
  { key: "nav.home", path: "/" },
  { key: "nav.about", path: "/about" },
  { key: "nav.stages", path: "/stages" },
  { key: "nav.news", path: "/news" },
  { key: "nav.contact", path: "/contact" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    apiGet<{ data: SchoolSettings }>("/settings").then((res) => setSettings(res.data)).catch(() => null);
  }, []);

  const schoolName = i18n.language === "ar" ? settings?.school_name_ar : (settings?.school_name_en || settings?.school_name_ar);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg truncate max-w-[60%]" style={{ color: "var(--color-primary)" }}>
            {schoolName || t("app_name")}
          </Link>

          {/* قائمة كاملة على الشاشات المتوسطة فأكبر */}
          <nav className="hidden md:flex gap-5 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} to={item.path}>{t(item.key)}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              className="text-xs text-gray-500 underline hidden sm:inline"
              onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
            >
              {i18n.language === "ar" ? "EN" : "AR"}
            </button>
            <Link
              to="/login"
              className="px-3 py-1.5 md:px-4 rounded-lg text-white text-sm whitespace-nowrap"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {t("nav.login")}
            </Link>

            {/* زر قائمة الموبايل (Hamburger) — يظهر فقط تحت md */}
            <button
              className="md:hidden p-2 -ml-1 text-gray-600"
              aria-label="القائمة"
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* قائمة الموبايل المنسدلة — بديل حقيقي وليس اختفاءً بلا وصول */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-3 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                {t(item.key)}
              </Link>
            ))}
            <button
              className="text-right text-gray-500 underline sm:hidden"
              onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
            >
              {i18n.language === "ar" ? "English" : "العربية"}
            </button>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-500 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <p className="font-bold text-gray-700 mb-1">{schoolName}</p>
            <p>{settings?.governorate}</p>
            <p>{settings?.address}</p>
          </div>
          <div>
            <p>{settings?.phone}</p>
            <p>{settings?.email}</p>
          </div>
          <div className="text-xs text-gray-400 md:text-left">
            {settings?.email && `للتواصل: ${settings.email}`}
          </div>
        </div>
      </footer>
    </div>
  );
}
