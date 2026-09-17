// worker/src/routes/parents.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const parents = new Hono<AppBindings>();
parents.use("*", authMiddleware);

// ---------- لولي الأمر: عرض أبنائه المرتبطين بحسابه فقط (بيانات ذاتية، ليست صلاحية إدارية) ----------
parents.get("/my-children", async (c) => {
  const roleCode = c.get("roleCode");
  const parentId = c.get("linkedEntityId");
  if (roleCode !== "parent" || !parentId) {
    return c.json({ error: "FORBIDDEN", message: "متاح فقط لحساب ولي أمر مرتبط بسجل ولي أمر" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.student_code, s.full_name
     FROM students s JOIN parent_student ps ON ps.student_id = s.id
     WHERE ps.parent_id = ? AND s.deleted_at IS NULL`
  )
    .bind(parentId)
    .all();

  return c.json({ data: results });
});

parents.get("/", permissionMiddleware("parents.crud"), async (c) => {
  const search = c.req.query("q");
  const where = search ? "WHERE p.full_name LIKE ?" : "";
  const values = search ? [`%${search}%`] : [];

  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.phone, p.email FROM parents p ${where} ORDER BY p.full_name LIMIT 50`
  )
    .bind(...values)
    .all();

  return c.json({ data: results });
});

parents.get("/:id", permissionMiddleware("parents.crud"), async (c) => {
  const id = c.req.param("id");
  const parent = await c.env.DB.prepare(`SELECT * FROM parents WHERE id = ?`).bind(id).first();
  if (!parent) return c.json({ error: "NOT_FOUND" }, 404);

  const childrenResult = await c.env.DB.prepare(
    `SELECT s.id, s.student_code, s.full_name, ps.relationship
     FROM students s JOIN parent_student ps ON ps.student_id = s.id
     WHERE ps.parent_id = ? AND s.deleted_at IS NULL`
  )
    .bind(id)
    .all();

  return c.json({ data: parent, children: childrenResult.results });
});

const parentSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

parents.post("/", permissionMiddleware("parents.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = parentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const id = nanoid();
  const { fullName, phone, email } = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO parents (id, full_name, phone, email, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, fullName, phone ?? null, email ?? null)
    .run();

  return c.json({ id }, 201);
});

parents.put("/:id", permissionMiddleware("parents.crud"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = parentSchema.partial().safeParse(body);
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
  await c.env.DB.prepare(`UPDATE parents SET ${setClauses.join(", ")} WHERE id = ?`).bind(...values).run();
  return c.json({ success: true });
});

// ---------- ربط ولي أمر بطالب (يدعم أكثر من ابن لنفس الحساب) ----------
const linkSchema = z.object({ studentId: z.string(), relationship: z.string().default("guardian") });

parents.post("/:id/link-student", permissionMiddleware("parents.crud"), async (c) => {
  const parentId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  try {
    await c.env.DB.prepare(
      `INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)`
    )
      .bind(parentId, parsed.data.studentId, parsed.data.relationship)
      .run();
  } catch {
    return c.json({ error: "ALREADY_LINKED", message: "الرابط موجود بالفعل" }, 409);
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'LINK_PARENT_STUDENT', 'parent', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), parentId, JSON.stringify(parsed.data))
    .run();

  return c.json({ success: true }, 201);
});

parents.delete("/:id/link-student/:studentId", permissionMiddleware("parents.crud"), async (c) => {
  const { id, studentId } = c.req.param();
  await c.env.DB.prepare(`DELETE FROM parent_student WHERE parent_id = ? AND student_id = ?`)
    .bind(id, studentId)
    .run();
  return c.json({ success: true });
});

export default parents;
