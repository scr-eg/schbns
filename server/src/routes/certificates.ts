// worker/src/routes/certificates.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import { generateCertificateViaGas } from "../lib/gasClient";
import type { AppBindings } from "../index";

const certificates = new Hono<AppBindings>();

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

const issueSchema = z.object({
  studentId: z.string(),
  academicYearId: z.string(),
  termId: z.string().optional(),
  certificateType: z.enum(["result_certificate", "transcript", "success_certificate"]),
});

certificates.post("/issue", authMiddleware, permissionMiddleware("certificates.issue"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  const { studentId, academicYearId, termId, certificateType } = parsed.data;

  const student = await c.env.DB.prepare(`SELECT student_code, full_name FROM students WHERE id = ?`)
    .bind(studentId).first<{ student_code: string; full_name: string }>();
  if (!student) return c.json({ error: "STUDENT_NOT_FOUND" }, 404);

  const academicYear = await c.env.DB.prepare(`SELECT name FROM academic_years WHERE id = ?`)
    .bind(academicYearId).first<{ name: string }>();

  const termCondition = termId ? `AND t.id = ?` : "";
  const bindValues = termId ? [studentId, academicYearId, termId] : [studentId, academicYearId];

  const resultsResult = await c.env.DB.prepare(
    `SELECT sub.name_ar as subject_name, er.total_score, es.max_score, t.name as term_name
     FROM exam_results er
     JOIN exam_subjects es ON es.id = er.exam_subject_id
     JOIN subjects sub ON sub.id = es.subject_id
     JOIN exams e ON e.id = es.exam_id
     JOIN terms t ON t.id = e.term_id
     WHERE er.student_id = ? AND e.academic_year_id = ? ${termCondition}
       AND er.workflow_state IN ('published', 'locked')`
  ).bind(...bindValues).all<{ subject_name: string; total_score: number; max_score: number; term_name: string }>();

  if (resultsResult.results.length === 0) {
    return c.json({ error: "NO_PUBLISHED_RESULTS", message: "لا توجد نتائج منشورة لهذا الطالب في الفترة المحددة" }, 400);
  }

  const totalScore = resultsResult.results.reduce((sum, r) => sum + r.total_score, 0);
  const totalMax = resultsResult.results.reduce((sum, r) => sum + r.max_score, 0);
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  const scale = await c.env.DB.prepare(
    `SELECT label_ar FROM grade_scale WHERE ? >= min_percentage AND ? < max_percentage LIMIT 1`
  ).bind(percentage, percentage).first<{ label_ar: string }>();

  const verificationCode = generateVerificationCode();

  let gasResult;
  try {
    gasResult = await generateCertificateViaGas(c.env, {
      studentName: student.full_name,
      studentCode: student.student_code,
      academicYear: academicYear?.name ?? "",
      term: resultsResult.results[0]?.term_name ?? "",
      subjects: resultsResult.results.map((r) => ({ name: r.subject_name, score: r.total_score })),
      totalScore,
      percentage: Math.round(percentage * 100) / 100,
      grade: scale?.label_ar ?? "",
      verificationCode,
    });
  } catch (err) {
    return c.json({
      error: "PDF_GENERATION_FAILED",
      message: "تعذّر توليد ملف PDF عبر Google Apps Script. تأكد من إعداد GAS_WEBAPP_URL والقالب بشكل صحيح.",
      details: String(err),
    }, 502);
  }

  const fileId = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO files (id, entity_type, entity_id, drive_file_id, view_url, uploaded_by, created_at)
     VALUES (?, 'certificate', ?, ?, ?, ?, datetime('now'))`
  ).bind(fileId, studentId, gasResult.driveFileId, gasResult.viewUrl, c.get("userId")).run();

  const certificateId = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO certificates (id, student_id, academic_year_id, term_id, certificate_type, file_id, verification_code, issued_by, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(certificateId, studentId, academicYearId, termId ?? null, certificateType, fileId, verificationCode, c.get("userId")).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'ISSUE_CERTIFICATE', 'certificate', ?, ?, datetime('now'))`
  ).bind(nanoid(), c.get("userId"), certificateId, JSON.stringify({ studentId, certificateType, verificationCode })).run();

  return c.json({
    id: certificateId,
    verificationCode,
    downloadUrl: gasResult.downloadUrl,
    viewUrl: gasResult.viewUrl,
  }, 201);
});

certificates.get("/student/:studentId", authMiddleware, permissionMiddleware(["certificates.read_own", "certificates.issue"]), async (c) => {
  const studentId = c.req.param("studentId");
  const roleCode = c.get("roleCode");
  const linkedEntityId = c.get("linkedEntityId");

  if (roleCode === "student" && linkedEntityId !== studentId) return c.json({ error: "FORBIDDEN" }, 403);
  if (roleCode === "parent") {
    const link = await c.env.DB.prepare(`SELECT 1 FROM parent_student WHERE parent_id = ? AND student_id = ?`)
      .bind(linkedEntityId, studentId).first();
    if (!link) return c.json({ error: "FORBIDDEN" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.certificate_type, c.verification_code, c.issued_at, f.view_url, ay.name as academic_year
     FROM certificates c
     JOIN files f ON f.id = c.file_id
     JOIN academic_years ay ON ay.id = c.academic_year_id
     WHERE c.student_id = ? ORDER BY c.issued_at DESC`
  ).bind(studentId).all();

  return c.json({ data: results });
});

certificates.get("/verify/:code", async (c) => {
  const code = c.req.param("code");
  const certificate = await c.env.DB.prepare(
    `SELECT c.certificate_type, c.issued_at, s.full_name, s.student_code, ay.name as academic_year
     FROM certificates c
     JOIN students s ON s.id = c.student_id
     JOIN academic_years ay ON ay.id = c.academic_year_id
     WHERE c.verification_code = ?`
  ).bind(code).first();

  if (!certificate) {
    return c.json({ valid: false, message: "رمز التحقق غير صحيح أو الشهادة غير موجودة" }, 404);
  }

  return c.json({ valid: true, certificate });
});

export default certificates;
