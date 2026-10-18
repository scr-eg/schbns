// worker/src/index.ts
import { Hono } from "hono";
import authRoutes from "./routes/auth";
import studentRoutes from "./routes/students";
import teacherRoutes from "./routes/teachers";
import parentRoutes from "./routes/parents";
import academicRoutes from "./routes/academic";
import timetableRoutes from "./routes/timetables";
import attendanceRoutes from "./routes/attendance";
import examRoutes from "./routes/exams";
import gradingRoutes from "./routes/grading";
import resultsRoutes from "./routes/results";
import certificatesRoutes from "./routes/certificates";
import reportsRoutes from "./routes/reports";
import notificationsRoutes from "./routes/notifications";
import searchRoutes from "./routes/search";
import auditRoutes from "./routes/audit";
import backupRoutes from "./routes/backup";
import importRoutes from "./routes/import";
import settingsRoutes from "./routes/settings";
import usersRoutes from "./routes/users";
import publicRoutes from "./routes/public";
import announcementsRoutes from "./routes/announcements";
import activitiesRoutes from "./routes/activities";
import analyticsRoutes from "./routes/analytics";
import { UploadValidationError } from "./lib/gasClient";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  GAS_WEBAPP_URL: string;
  GAS_API_SECRET: string;
  ENCRYPTION_KEY?: string; // Base64 لـ 32 بايت - لتشفير الرقم القومي
  FRONTEND_ORIGIN?: string; // اختياري: الـ API على نفس النطاق (same-origin)
  ENVIRONMENT?: string;
}

// البيانات التي يحقنها authMiddleware في الـ Context، تُستخدم عبر كل الـ Routes
export interface Variables {
  userId: string;
  roleCode: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export type AppBindings = { Bindings: Env; Variables: Variables };

const app = new Hono<AppBindings>();

app.get("/api/health", (c) => c.json({ status: "ok", env: c.env.ENVIRONMENT ?? "production" }));

app.route("/api/auth", authRoutes);
app.route("/api/students", studentRoutes);
app.route("/api/teachers", teacherRoutes);
app.route("/api/parents", parentRoutes);
app.route("/api/academic", academicRoutes);
app.route("/api/timetables", timetableRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/exams", examRoutes);
app.route("/api/grading", gradingRoutes);
app.route("/api/results", resultsRoutes);
app.route("/api/certificates", certificatesRoutes);
app.route("/api/reports", reportsRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/audit-logs", auditRoutes);
app.route("/api/backup", backupRoutes);
app.route("/api/import", importRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/public", publicRoutes);
app.route("/api/announcements", announcementsRoutes);
app.route("/api/activities", activitiesRoutes);
app.route("/api/analytics", analyticsRoutes);

app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));
app.onError((err, c) => {
  if (err instanceof UploadValidationError) {
    return c.json({ error: "INVALID_UPLOAD", message: err.message }, 400);
  }
  console.error(err);
  return c.json({ error: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع" }, 500);
});

export default app;
