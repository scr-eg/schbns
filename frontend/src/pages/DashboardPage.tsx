import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { apiGet } from "../lib/api";
import NotificationBell from "../components/NotificationBell";
import GlobalSearchBar from "../components/GlobalSearchBar";

interface MyExamSubject {
  exam_subject_id: string;
  exam_name: string;
  subject_name: string;
  grade_name: string;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [myExamSubjects, setMyExamSubjects] = useState<MyExamSubject[]>([]);

  useEffect(() => {
    if (user?.role_code === "teacher") {
      apiGet<{ data: MyExamSubject[] }>("/exams/mine/subjects").then((r) => setMyExamSubjects(r.data)).catch(() => null);
    }
  }, [user]);

  const stats = [
    { label: t("dashboard.students_total"), value: "—" },
    { label: t("dashboard.teachers_total"), value: "—" },
    { label: t("dashboard.attendance_today"), value: "—" },
    { label: t("dashboard.absence_today"), value: "—" },
  ];

  const isAdmin = user?.role_code === "super_admin" || user?.role_code === "school_admin";

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-gray-400">مرحبًا، {user?.username}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <GlobalSearchBar />}
          <NotificationBell />
          <button onClick={() => logout()} className="text-sm text-red-600 underline">
            تسجيل الخروج
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <Link to="/admin/students" className="px-4 py-2 rounded-lg border text-sm">إدارة الطلاب</Link>
          <Link to="/admin/teachers" className="px-4 py-2 rounded-lg border text-sm">إدارة المعلمين</Link>
          <Link to="/admin/parents" className="px-4 py-2 rounded-lg border text-sm">إدارة أولياء الأمور</Link>
          <Link to="/admin/timetables" className="px-4 py-2 rounded-lg border text-sm">الجداول الدراسية</Link>
          <Link to="/admin/exams" className="px-4 py-2 rounded-lg border text-sm">الامتحانات والكنترول</Link>
          <Link to="/admin/reports" className="px-4 py-2 rounded-lg border text-sm">مركز التقارير</Link>
          <Link to="/admin/audit-log" className="px-4 py-2 rounded-lg border text-sm">سجل العمليات</Link>
          {user?.role_code === "super_admin" && (
            <Link to="/admin/backup" className="px-4 py-2 rounded-lg border text-sm">النسخ الاحتياطي</Link>
          )}
          <Link to="/admin/announcements" className="px-4 py-2 rounded-lg border text-sm">إدارة الأخبار والإعلانات</Link>
          <Link to="/admin/users" className="px-4 py-2 rounded-lg border text-sm">إدارة المستخدمين</Link>
          <Link to="/admin/settings" className="px-4 py-2 rounded-lg border text-sm">إعدادات المدرسة</Link>
        </div>
      )}

      {user?.role_code === "exam_controller" && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <Link to="/admin/exams" className="px-4 py-2 rounded-lg border text-sm">الامتحانات والكنترول</Link>
          <Link to="/admin/certificates" className="px-4 py-2 rounded-lg border text-sm">إصدار الشهادات</Link>
        </div>
      )}

      {user?.role_code === "teacher" && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <Link to="/teacher/attendance" className="px-4 py-2 rounded-lg border text-sm">تسجيل الحضور</Link>
          </div>
          {myExamSubjects.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <p className="font-bold text-sm mb-3">مواد الامتحانات المُكلَّف بها</p>
              <div className="flex gap-2 flex-wrap">
                {myExamSubjects.map((es) => (
                  <Link key={es.exam_subject_id} to={`/teacher/grades/${es.exam_subject_id}`}
                    className="px-3 py-1.5 rounded-lg border text-xs">
                    {es.exam_name} — {es.subject_name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(user?.role_code === "student" || user?.role_code === "parent") && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <Link to="/my-results" className="px-4 py-2 rounded-lg border text-sm">النتائج</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
