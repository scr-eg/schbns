// worker/src/routes/notifications.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const notifications = new Hono<AppBindings>();
notifications.use("*", authMiddleware);

notifications.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, type, is_read, created_at FROM notifications
     WHERE user_id = ? ORDER BY is_read ASC, created_at DESC LIMIT 50`
  ).bind(userId).all();

  const unreadCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND is_read = 0`
  ).bind(userId).first<{ n: number }>();

  return c.json({ data: results, unreadCount: unreadCount?.n ?? 0 });
});

notifications.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .bind(id, userId).run();
  return c.json({ success: true });
});

notifications.patch("/read-all", async (c) => {
  const userId = c.get("userId");
  await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).bind(userId).run();
  return c.json({ success: true });
});

const createSchema = z.object({ userId: z.string(), title: z.string().min(1), body: z.string().optional(), type: z.string().optional() });
notifications.post("/", permissionMiddleware("users.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(id, parsed.data.userId, parsed.data.title, parsed.data.body ?? null, parsed.data.type ?? "manual").run();

  return c.json({ id }, 201);
});

export default notifications;
