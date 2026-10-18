// worker/src/routes/users.ts
import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const users = new Hono<AppBindings>();
users.use("*", authMiddleware);
users.use("*", permissionMiddleware("users.manage"));

users.get("/", async (c) => {
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = 20;
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.status, u.last_login_at, r.code as role_code, r.name_ar as role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.deleted_at IS NULL
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ data: results, page, pageSize });
});

users.get("/roles", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, code, name_ar, name_en FROM roles ORDER BY name_ar`).all();
  return c.json({ data: results });
});

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email().optional(),
  password: z.string().min(8),
  roleCode: z.string().min(2),
  linkedEntityType: z.enum(["student", "parent", "teacher", "staff"]).optional(),
  linkedEntityId: z.string().optional(),
});

users.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }
  const { username, email, password, roleCode, linkedEntityType, linkedEntityId } = parsed.data;

  const role = await c.env.DB.prepare(`SELECT id FROM roles WHERE code = ?`).bind(roleCode).first<{ id: string }>();
  if (!role) return c.json({ error: "INVALID_ROLE" }, 400);

  // منع أي مستخدم عدا super_admin من إنشاء حساب super_admin آخر
  const actingRole = c.get("roleCode") as string;
  if (roleCode === "super_admin" && actingRole !== "super_admin") {
    return c.json({ error: "FORBIDDEN", message: "فقط مسؤول النظام العام يمكنه إنشاء حسابات بهذا المستوى" }, 403);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = nanoid();

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, role_id, status, linked_entity_type, linked_entity_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(id, username, email ?? null, passwordHash, role.id, linkedEntityType ?? null, linkedEntityId ?? null)
      .run();
  } catch {
    return c.json({ error: "DUPLICATE_USERNAME" }, 409);
  }

  const actingUserId = c.get("userId") as string;
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'CREATE_USER', 'user', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), actingUserId, id, JSON.stringify({ username, roleCode }))
    .run();

  return c.json({ id, message: "تم إنشاء المستخدم بنجاح" }, 201);
});

const updateStatusSchema = z.object({ status: z.enum(["active", "locked", "disabled"]) });

users.patch("/:id/status", async (c) => {
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const actingUserId = c.get("userId") as string;
  if (targetId === actingUserId) {
    return c.json({ error: "CANNOT_MODIFY_SELF", message: "لا يمكنك تعديل حالة حسابك الخاص" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET status = ?, failed_login_attempts = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(parsed.data.status, targetId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'UPDATE_USER_STATUS', 'user', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), actingUserId, targetId, parsed.data.status)
    .run();

  return c.json({ success: true });
});

export default users;
