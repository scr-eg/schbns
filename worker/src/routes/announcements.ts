// worker/src/routes/announcements.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const announcements = new Hono<AppBindings>();

// ---------- عرض عام (للموقع الرئيسي) ----------
// يعرض فقط المنشور (published) والذي حان وقت نشره، مرتّبًا بالأحدث
announcements.get("/", async (c) => {
  const audience = c.req.query("audience"); // اختياري: تصفية حسب الفئة المستهدفة
  const limit = Number(c.req.query("limit") ?? "10");

  const query = audience
    ? `SELECT id, title, body, audience, publish_at, created_at FROM announcements
       WHERE status = 'published' AND (publish_at IS NULL OR publish_at <= datetime('now'))
       AND (audience = 'all' OR audience = ?)
       ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ?`
    : `SELECT id, title, body, audience, publish_at, created_at FROM announcements
       WHERE status = 'published' AND (publish_at IS NULL OR publish_at <= datetime('now'))
       ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ?`;

  const stmt = audience
    ? c.env.DB.prepare(query).bind(audience, limit)
    : c.env.DB.prepare(query).bind(limit);

  const { results } = await stmt.all();
  return c.json({ data: results });
});

// ---------- إدارة كاملة (لوحة الأدمن) ----------
announcements.use("/admin/*", authMiddleware, permissionMiddleware("announcements.crud"));

// قائمة كل الإعلانات بكل حالاتها (مسودة/منشور/مجدول/مؤرشف) للإدارة فقط
announcements.get("/admin/all", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, audience, status, publish_at, created_at FROM announcements ORDER BY created_at DESC`
  ).all();
  return c.json({ data: results });
});

const createSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  audience: z.enum(["all", "students", "parents", "teachers", "staff"]).default("all"),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  publishAt: z.string().optional(), // ISO string، مطلوب إن كانت الحالة scheduled
});

announcements.post("/admin", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const { title, body: content, audience, status, publishAt } = parsed.data;
  if (status === "scheduled" && !publishAt) {
    return c.json({ error: "PUBLISH_AT_REQUIRED", message: "يجب تحديد وقت النشر عند اختيار الجدولة" }, 400);
  }

  const id = nanoid();
  const userId = c.get("userId");
  await c.env.DB.prepare(
    `INSERT INTO announcements (id, title, body, audience, status, publish_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, title, content, audience, status, publishAt ?? null, userId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'CREATE_ANNOUNCEMENT', 'announcement', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), userId, id, JSON.stringify({ title, status }))
    .run();

  return c.json({ id }, 201);
});

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  body: z.string().min(2).optional(),
  audience: z.enum(["all", "students", "parents", "teachers", "staff"]).optional(),
  status: z.enum(["draft", "published", "scheduled", "archived"]).optional(),
  publishAt: z.string().optional(),
});

announcements.patch("/admin/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const columnMap: Record<string, string> = {
    title: "title", body: "body", audience: "audience", status: "status", publishAt: "publish_at",
  };
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    setClauses.push(`${columnMap[key]} = ?`);
    values.push(value);
  }
  if (setClauses.length === 0) return c.json({ error: "NO_FIELDS_TO_UPDATE" }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE announcements SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const userId = c.get("userId");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'UPDATE_ANNOUNCEMENT', 'announcement', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), userId, id, JSON.stringify(parsed.data))
    .run();

  return c.json({ success: true });
});

announcements.delete("/admin/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();

  const userId = c.get("userId");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'DELETE_ANNOUNCEMENT', 'announcement', ?, datetime('now'))`
  )
    .bind(nanoid(), userId, id)
    .run();

  return c.json({ success: true });
});

export default announcements;
