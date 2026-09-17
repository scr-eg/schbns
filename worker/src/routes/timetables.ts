// worker/src/routes/timetables.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const timetables = new Hono<AppBindings>();
timetables.use("*", authMiddleware);

// ---------- عرض جدول فصل أو معلم معيّن ----------
timetables.get("/", permissionMiddleware(["timetable.read", "timetable.crud"]), async (c) => {
  const sectionId = c.req.query("sectionId");
  const teacherId = c.req.query("teacherId");
  const academicYearId = c.req.query("academicYearId");

  if (!sectionId && !teacherId) {
    return c.json({ error: "MISSING_FILTER", message: "يجب تحديد sectionId أو teacherId" }, 400);
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  if (sectionId) { conditions.push("t.section_id = ?"); values.push(sectionId); }
  if (teacherId) { conditions.push("t.teacher_id = ?"); values.push(teacherId); }
  if (academicYearId) { conditions.push("t.academic_year_id = ?"); values.push(academicYearId); }

  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.day_of_week, t.period_index, t.room,
            sub.name_ar as subject_name, te.full_name as teacher_name,
            sec.name as section_name, cl.name_ar as class_name
     FROM timetables t
     JOIN subjects sub ON sub.id = t.subject_id
     JOIN teachers te ON te.id = t.teacher_id
     JOIN sections sec ON sec.id = t.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.day_of_week, t.period_index`
  )
    .bind(...values)
    .all();

  return c.json({ data: results });
});

// ---------- إنشاء حصة جديدة (يمنع التعارض تلقائيًا عبر UNIQUE constraints في القاعدة) ----------
const createSchema = z.object({
  sectionId: z.string(),
  subjectId: z.string(),
  teacherId: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  periodIndex: z.number().int().min(1),
  room: z.string().optional(),
  academicYearId: z.string(),
});

timetables.post("/", permissionMiddleware("timetable.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const { sectionId, subjectId, teacherId, dayOfWeek, periodIndex, room, academicYearId } = parsed.data;
  const id = nanoid();

  try {
    await c.env.DB.prepare(
      `INSERT INTO timetables (id, section_id, subject_id, teacher_id, day_of_week, period_index, room, academic_year_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, sectionId, subjectId, teacherId, dayOfWeek, periodIndex, room ?? null, academicYearId)
      .run();
  } catch (err) {
    // ⚠️ التحقق من التعارض هنا فعلي وليس شكليًا: القيد UNIQUE في قاعدة البيانات
    // (section+day+period) و(teacher+day+period) يمنع أي تعارض فعليًا حتى لو تسابقت الطلبات.
    const message = String(err).includes("UNIQUE")
      ? "يوجد تعارض: إما أن الفصل مشغول في هذه الحصة، أو أن المعلم مُكلَّف بحصة أخرى في نفس التوقيت"
      : "تعذّر إنشاء الحصة";
    return c.json({ error: "SCHEDULE_CONFLICT", message }, 409);
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'CREATE_TIMETABLE_SLOT', 'timetable', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), id, JSON.stringify(parsed.data))
    .run();

  return c.json({ id }, 201);
});

timetables.delete("/:id", permissionMiddleware("timetable.crud"), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM timetables WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});

export default timetables;
