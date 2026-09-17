// worker/src/routes/reports.ts
import { Hono, Context } from "hono";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const reports = new Hono<AppBindings>();
reports.use("*", authMiddleware, permissionMiddleware(["reports.read", "reports.read_limited"]));

/** يحوّل مصفوفة كائنات إلى نص CSV فعلي (بدون مكتبات خارجية) قابل للفتح مباشرة في Excel */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return "\uFEFF" + lines.join("\r\n"); // BOM لدعم عرض العربية بشكل صحيح في Excel
}

function respondWithFormat(c: Context<AppBindings>, rows: Record<string, unknown>[], filename: string) {
  const format = c.req.query("format");
  if (format === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }
  return c.json({ data: rows });
}

// ---------- كشف الطلاب ----------
reports.get("/students", async (c) => {
  const stageId = c.req.query("stageId");
  const conditions = ["s.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (stageId) { conditions.push("s.current_stage_id = ?"); values.push(stageId); }

  const { results } = await c.env.DB.prepare(
    `SELECT s.student_code as "كود الطالب", s.full_name as "الاسم", st.name_ar as "المرحلة", s.status as "الحالة"
     FROM students s LEFT JOIN stages st ON st.id = s.current_stage_id
     WHERE ${conditions.join(" AND ")} ORDER BY s.full_name`
  ).bind(...values).all();

  return respondWithFormat(c, results as Record<string, unknown>[], "students-report");
});

// ---------- ملخص حضور فصل لشهر ----------
reports.get("/attendance-summary", async (c) => {
  const sectionId = c.req.query("sectionId");
  const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
  if (!sectionId) return c.json({ error: "MISSING_SECTION" }, 400);

  const { results } = await c.env.DB.prepare(
    `SELECT s.full_name as "الطالب",
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as "أيام الحضور",
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as "أيام الغياب",
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as "أيام التأخير",
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as "غياب بعذر"
     FROM students s
     JOIN attendance a ON a.student_id = s.id
     WHERE a.section_id = ? AND a.date LIKE ?
     GROUP BY s.id, s.full_name ORDER BY s.full_name`
  ).bind(sectionId, `${month}%`).all();

  return respondWithFormat(c, results as Record<string, unknown>[], "attendance-summary");
});

// ---------- ملخص نتائج امتحان (نجاح/رسوب/متوسط) ----------
reports.get("/exam-results-summary/:examId", async (c) => {
  const examId = c.req.param("examId");

  const { results } = await c.env.DB.prepare(
    `SELECT sub.name_ar as "المادة",
            COUNT(er.id) as "عدد الطلاب",
            SUM(CASE WHEN er.status = 'pass' THEN 1 ELSE 0 END) as "الناجحون",
            SUM(CASE WHEN er.status = 'fail' THEN 1 ELSE 0 END) as "الراسبون",
            ROUND(AVG(er.percentage), 1) as "متوسط النسبة %"
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN exam_results er ON er.exam_subject_id = es.id
     WHERE es.exam_id = ?
     GROUP BY es.id, sub.name_ar`
  ).bind(examId).all();

  return respondWithFormat(c, results as Record<string, unknown>[], "exam-results-summary");
});

// ---------- أفضل النتائج في امتحان ----------
reports.get("/top-results/:examId", async (c) => {
  const examId = c.req.param("examId");
  const limit = Number(c.req.query("limit") ?? "10");

  const { results } = await c.env.DB.prepare(
    `SELECT s.full_name as "الطالب", SUM(er.total_score) as "المجموع", ROUND(AVG(er.percentage), 1) as "متوسط النسبة %"
     FROM exam_results er
     JOIN exam_subjects es ON es.id = er.exam_subject_id
     JOIN students s ON s.id = er.student_id
     WHERE es.exam_id = ? AND er.workflow_state IN ('published', 'locked')
     GROUP BY s.id, s.full_name
     ORDER BY SUM(er.total_score) DESC LIMIT ?`
  ).bind(examId, limit).all();

  return respondWithFormat(c, results as Record<string, unknown>[], "top-results");
});

export default reports;
