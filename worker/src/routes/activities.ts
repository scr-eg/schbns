// worker/src/routes/activities.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const activities = new Hono<AppBindings>();

activities.get("/", async (c) => {
  const limit = Number(c.req.query("limit") ?? "12");
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, category, activity_date FROM activities
     ORDER BY COALESCE(activity_date, '9999-12-31') ASC LIMIT ?`
  )
    .bind(limit)
    .all();
  return c.json({ data: results });
});

activities.use("/admin/*", authMiddleware, permissionMiddleware("activities.crud"));

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(["sports", "cultural", "arts", "trip", "competition", "ceremony"]),
  activityDate: z.string().optional(),
});

activities.post("/admin", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const id = nanoid();
  const { title, description, category, activityDate } = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO activities (id, title, description, category, activity_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, title, description ?? null, category, activityDate ?? null, c.get("userId"))
    .run();

  return c.json({ id }, 201);
});

activities.delete("/admin/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM activities WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ success: true });
});

export default activities;
