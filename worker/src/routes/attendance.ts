// worker/src/routes/attendance.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const attendance = new Hono<AppBindings>();
attendance.use("*", authMiddleware);

// ---------- كشف حضور فصل ليوم معيّن (لتسجيل الحضور) ----------
attendance.get("/roster", permissionMiddleware(["attendance.record", "attendance.read"]), async (c) => {
  const sectionId = c.req.query("sectionId");
  const date = c.req.query("date");
  const periodIndex = c.req.query("periodIndex");

  if (!sectionId || !date) {
    return c.json({ error: "MISSING_PARAMS", message: "sectionId و date مطلوبان" }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT s.id as student_id, s.student_code, s.full_name,
            a.id as attendance_id, a.status
     FROM student_classes sc
     JOIN students s ON s.id = sc.student_id
     LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? AND a.period_index IS ?
     WHERE sc.section_id = ? AND s.deleted_at IS NULL
     ORDER BY s.full_name`
  )
    .bind(date, periodIndex ?? null, sectionId)
    .all();

  return c.json({ data: results });
});

// ---------- تسجيل حضور جماعي للفصل (Upsert ذرّي عبر D1 batch) ----------
const bulkSchema = z.object({
  sectionId: z.string(),
  date: z.string(),
  periodIndex: z.number().int().optional(),
  subjectId: z.string().optional(),
  records: z.array(z.object({
    studentId: z.string(),
    status: z.enum(["present", "absent", "late", "excused"]),
  })).min(1),
});

attendance.post("/bulk", permissionMiddleware("attendance.record"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const { sectionId, date, periodIndex, subjectId, records } = parsed.data;
  const userId = c.get("userId");

  const statements = records.map((r) =>
    c.env.DB.prepare(
      `INSERT INTO attendance (id, student_id, section_id, subject_id, date, period_index, status, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, date, period_index) DO UPDATE SET
         status = excluded.status, recorded_by = excluded.recorded_by, section_id = excluded.section_id`
    ).bind(nanoid(), r.studentId, sectionId, subjectId ?? null, date, periodIndex ?? null, r.status, userId)
  );

  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    return c.json({ error: "ATTENDANCE_SAVE_FAILED", message: String(err) }, 500);
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, new_value, created_at)
     VALUES (?, ?, 'RECORD_ATTENDANCE', 'attendance', ?, datetime('now'))`
  )
    .bind(nanoid(), userId, JSON.stringify({ sectionId, date, count: records.length }))
    .run();

  return c.json({ success: true, recordedCount: records.length });
});

// ---------- تقرير حضور طالب ----------
attendance.get(
  "/reports/student/:id",
  permissionMiddleware(["attendance.read", "attendance.read_own"]),
  async (c) => {
    const studentId = c.req.param("id");
    const roleCode = c.get("roleCode");
    const linkedEntityId = c.get("linkedEntityId");

    if ((roleCode === "student" || roleCode === "parent") && linkedEntityId !== studentId) {
      if (roleCode === "parent") {
        const link = await c.env.DB.prepare(
          `SELECT 1 FROM parent_student WHERE parent_id = ? AND student_id = ?`
        ).bind(linkedEntityId, studentId).first();
        if (!link) return c.json({ error: "FORBIDDEN" }, 403);
      } else {
        return c.json({ error: "FORBIDDEN" }, 403);
      }
    }

    const from = c.req.query("from");
    const to = c.req.query("to");
    const conditions = ["student_id = ?"];
    const values: unknown[] = [studentId];
    if (from) { conditions.push("date >= ?"); values.push(from); }
    if (to) { conditions.push("date <= ?"); values.push(to); }

    const { results } = await c.env.DB.prepare(
      `SELECT date, period_index, status FROM attendance WHERE ${conditions.join(" AND ")} ORDER BY date DESC`
    )
      .bind(...values)
      .all<{ status: string }>();

    const summary = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of results) summary[r.status as keyof typeof summary]++;

    return c.json({ data: results, summary });
  }
);

// ---------- تقرير حضور فصل لشهر معيّن ----------
attendance.get("/reports/section/:id", permissionMiddleware("attendance.read"), async (c) => {
  const sectionId = c.req.param("id");
  const month = c.req.query("month");

  const { results } = await c.env.DB.prepare(
    `SELECT s.full_name, a.date, a.status
     FROM attendance a JOIN students s ON s.id = a.student_id
     WHERE a.section_id = ? AND a.date LIKE ?
     ORDER BY a.date, s.full_name`
  )
    .bind(sectionId, `${month ?? new Date().toISOString().slice(0, 7)}%`)
    .all();

  return c.json({ data: results });
});

export default attendance;
