import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import StagesPage from "./pages/StagesPage";
import NewsPage from "./pages/NewsPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import AnnouncementsAdminPage from "./pages/AnnouncementsAdminPage";
import StudentsAdminPage from "./pages/StudentsAdminPage";
import StudentsImportPage from "./pages/StudentsImportPage";
import TeachersAdminPage from "./pages/TeachersAdminPage";
import ParentsAdminPage from "./pages/ParentsAdminPage";
import TimetableAdminPage from "./pages/TimetableAdminPage";
import TeacherAttendancePage from "./pages/TeacherAttendancePage";
import ExamsAdminPage from "./pages/ExamsAdminPage";
import ExamDetailPage from "./pages/ExamDetailPage";
import GradeEntryPage from "./pages/GradeEntryPage";
import MyResultsPage from "./pages/MyResultsPage";
import CertificatesAdminPage from "./pages/CertificatesAdminPage";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogPage from "./pages/AuditLogPage";
import BackupPage from "./pages/BackupPage";
import ProtectedRoute from "./components/ProtectedRoute";

const ADMIN_ROLES = ["super_admin", "school_admin", "student_affairs"];

export default function App() {
  return (
    <Routes>
      {/* الموقع العام */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/stages" element={<StagesPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* المصادقة */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* لوحات محمية */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin"]}><SettingsPage /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin"]}><UsersPage /></ProtectedRoute>
      } />
      <Route path="/admin/announcements" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "principal", "vice_principal"]}>
          <AnnouncementsAdminPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/students" element={
        <ProtectedRoute allowedRoles={ADMIN_ROLES}><StudentsAdminPage /></ProtectedRoute>
      } />
      <Route path="/admin/students/import" element={
        <ProtectedRoute allowedRoles={ADMIN_ROLES}><StudentsImportPage /></ProtectedRoute>
      } />
      <Route path="/admin/teachers" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "hr"]}><TeachersAdminPage /></ProtectedRoute>
      } />
      <Route path="/admin/parents" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin"]}><ParentsAdminPage /></ProtectedRoute>
      } />
      <Route path="/admin/timetables" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "vice_principal"]}>
          <TimetableAdminPage />
        </ProtectedRoute>
      } />
      <Route path="/teacher/attendance" element={
        <ProtectedRoute allowedRoles={["teacher"]}><TeacherAttendancePage /></ProtectedRoute>
      } />
      <Route path="/admin/exams" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "exam_controller"]}>
          <ExamsAdminPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/exams/:id" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "exam_controller"]}>
          <ExamDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/teacher/grades/:examSubjectId" element={
        <ProtectedRoute allowedRoles={["teacher", "exam_controller", "super_admin", "school_admin"]}>
          <GradeEntryPage />
        </ProtectedRoute>
      } />
      <Route path="/my-results" element={
        <ProtectedRoute allowedRoles={["student", "parent"]}><MyResultsPage /></ProtectedRoute>
      } />
      <Route path="/admin/certificates" element={
        <ProtectedRoute allowedRoles={["exam_controller", "super_admin"]}><CertificatesAdminPage /></ProtectedRoute>
      } />
      <Route path="/verify/:code" element={<VerifyCertificatePage />} />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "principal", "vice_principal", "exam_controller", "student_affairs", "hr", "accountant"]}>
          <ReportsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/audit-log" element={
        <ProtectedRoute allowedRoles={["super_admin", "school_admin", "principal", "exam_controller"]}>
          <AuditLogPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/backup" element={
        <ProtectedRoute allowedRoles={["super_admin"]}><BackupPage /></ProtectedRoute>
      } />

      {/* المشروع مكتمل عبر Phase 10 — راجع docs/ للتوثيق النهائي الكامل */}
    </Routes>
  );
}
