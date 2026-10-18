import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface Stats {
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
  stagesCount: number;
  yearsOfExperience: number | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface Activity {
  id: string;
  title: string;
  category: string;
  activity_date: string | null;
}

interface CalendarTerm {
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
}

interface SchoolSettings {
  school_name_ar: string;
  school_name_en: string | null;
}

export default function HomePage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [calendar, setCalendar] = useState<CalendarTerm[]>([]);

  useEffect(() => {
    apiGet<{ data: SchoolSettings }>("/settings").then((r) => setSettings(r.data)).catch(() => null);
    apiGet<Stats>("/public/stats").then(setStats).catch(() => null);
    apiGet<{ data: Announcement[] }>("/announcements?limit=3").then((r) => setAnnouncements(r.data)).catch(() => null);
    apiGet<{ data: Activity[] }>("/activities?limit=3").then((r) => setActivities(r.data)).catch(() => null);
    apiGet<{ data: CalendarTerm[] }>("/public/academic-calendar").then((r) => setCalendar(r.data)).catch(() => null);
  }, []);

  const statCards = [
    { label: "عدد الطلاب", value: stats?.studentsCount },
    { label: "عدد المعلمين", value: stats?.teachersCount },
    { label: "عدد الفصول", value: stats?.classesCount },
    { label: "المراحل التعليمية", value: stats?.stagesCount },
    { label: "سنوات الخبرة", value: stats?.yearsOfExperience },
  ];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="text-center py-16 px-4 bg-gradient-to-b from-white to-gray-50">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          {settings?.school_name_ar || "منصة المدرسة"}
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto mb-6">
          نحو تعليم أفضل لكل طالب — رسالتنا بناء جيل واعٍ ومتميز أكاديميًا وسلوكيًا.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link to="/login" className="px-5 py-2 rounded-lg text-white" style={{ backgroundColor: "var(--color-primary)" }}>
            بوابة الطالب
          </Link>
          <Link to="/login" className="px-5 py-2 rounded-lg border">بوابة ولي الأمر</Link>
          <Link to="/login" className="px-5 py-2 rounded-lg border">بوابة المعلم</Link>
        </div>
      </section>

      {/* Statistics */}
      <section className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
              {s.value ?? "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* News / Announcements */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{t("nav.news")}</h2>
          <Link to="/news" className="text-sm underline text-gray-500">عرض الكل</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {announcements.length === 0 && <p className="text-gray-400 text-sm">لا توجد إعلانات منشورة حاليًا.</p>}
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-bold mb-1">{a.title}</p>
              <p className="text-sm text-gray-500 line-clamp-3">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Events / Activities */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <h2 className="text-lg font-bold mb-4">الأنشطة والفعاليات</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {activities.length === 0 && <p className="text-gray-400 text-sm">لا توجد أنشطة مجدولة حاليًا.</p>}
          {activities.map((act) => (
            <div key={act.id} className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-bold mb-1">{act.title}</p>
              <p className="text-xs text-gray-400">{act.activity_date}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Academic Calendar */}
      {calendar.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-6">
          <h2 className="text-lg font-bold mb-4">التقويم الدراسي</h2>
          <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="text-gray-500">
                <tr><th className="text-right py-2">الترم</th><th className="text-right py-2">من</th><th className="text-right py-2">إلى</th></tr>
              </thead>
              <tbody>
                {calendar.map((term) => (
                  <tr key={term.name} className="border-t">
                    <td className="py-2">{term.name} ({term.academic_year})</td>
                    <td className="py-2">{term.start_date}</td>
                    <td className="py-2">{term.end_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold mb-4">روابط سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["الجداول", "الامتحانات", "النتائج", "الحضور"].map((label) => (
            <Link key={label} to="/login" className="bg-white rounded-xl shadow-sm p-4 text-center text-sm hover:shadow-md transition">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
