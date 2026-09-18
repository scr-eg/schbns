// worker/src/routes/teachers.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const teachers = new Hono<AppBindings>();
teachers.use("*", authMiddleware);

teachers.get("/", permissionMiddleware(["teachers.read", "teachers.crud"]), async (c) => {
  const search = c.req.query("q");
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = 20;

  const where = search ? "WHERE t.deleted_at IS NULL AND t.full_name LIKE ?" : "WHERE t.deleted_at IS NULL";
  const values = search ? [`%${search}%`] : [];

  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.full_name, t.phone, t.email FROM teachers t ${where}
     ORDER BY t.full_name LIMIT ? OFFSET ?`
  )
    .bind(...values, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ data: results, page, pageSize });
});

teachers.get("/:id", permissionMiddleware(["teachers.read", "teachers.crud"]), async (c) => {
  const id = c.req.param("id");
  const teacher = await c.env.DB.prepare(`SELECT * FROM teachers WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first();
  if (!teacher) return c.json({ error: "NOT_FOUND" }, 404);

  const subjects = await c.env.DB.prepare(
    `SELECT ts.id, sub.name_ar as subject_name, sec.name as section_name, cl.name_ar as class_name
     FROM teacher_subjects ts
     JOIN subjects sub ON sub.id = ts.subject_id
     JOIN sections sec ON sec.id = ts.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE ts.teacher_id = ?`
  )
    .bind(id)
    .all();

  return c.json({ data: teacher, subjects: subjects.results });
});

teachers.get("/me/subjects", async (c) => {
  const roleCode = c.get("roleCode");
  const linkedEntityId = c.get("linkedEntityId");
  if (roleCode !== "teacher" || !linkedEntityId) {
    return c.json({ error: "FORBIDDEN", message: "هذا المسار متاح فقط لحساب معلم مرتبط بسجل معلم" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ts.id, sub.id as subject_id, sub.name_ar as subject_name,
            sec.id as section_id, sec.name as section_name, cl.name_ar as class_name
     FROM teacher_subjects ts
     JOIN subjects sub ON sub.id = ts.subject_id
     JOIN sections sec ON sec.id = ts.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE ts.teacher_id = ?`
  )
    .bind(linkedEntityId)
    .all();

  return c.json({ data: results });
});

const teacherSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

teachers.post("/", permissionMiddleware("teachers.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = teacherSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const id = nanoid();
  const { fullName, phone, email } = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO teachers (id, full_name, phone, email, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, fullName, phone ?? null, email ?? null)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'CREATE_TEACHER', 'teacher', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), id, JSON.stringify(parsed.data))
    .run();

  return c.json({ id }, 201);
});

teachers.put("/:id", permissionMiddleware("teachers.crud"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = teacherSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const columnMap: Record<string, string> = { fullName: "full_name", phone: "phone", email: "email" };
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    setClauses.push(`${columnMap[key]} = ?`);
    values.push(value);
  }
  if (setClauses.length === 0) return c.json({ error: "NO_FIELDS_TO_UPDATE" }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE teachers SET ${setClauses.join(", ")} WHERE id = ?`).bind(...values).run();
  return c.json({ success: true });
});

teachers.delete("/:id", permissionMiddleware("teachers.crud"), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`UPDATE teachers SET deleted_at = datetime('now') WHERE id = ?`).bind(id).run();
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'DELETE_TEACHER', 'teacher', ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), id)
    .run();
  return c.json({ success: true });
});

// ---------- تكليف معلم بمادة/فصل ----------
const assignSchema = z.object({ subjectId: z.string(), sectionId: z.string(), academicYearId: z.string() });

teachers.post("/:id/assign", permissionMiddleware("teachers.crud"), async (c) => {
  const teacherId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO teacher_subjects (id, teacher_id, subject_id, section_id, academic_year_id) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, teacherId, parsed.data.subjectId, parsed.data.sectionId, parsed.data.academicYearId)
    .run();

  return c.json({ id }, 201);
});

export default teachers;
