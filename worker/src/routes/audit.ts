// worker/src/routes/audit.ts
import { Hono } from "hono";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const audit = new Hono<AppBindings>();
audit.use("*", authMiddleware, permissionMiddleware("audit.read"));

audit.get("/", async (c) => {
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = 30;
  const action = c.req.query("action");
  const entityType = c.req.query("entityType");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const conditions: string[] = [];
  const values: unknown[] = [];
  if (action) { conditions.push("al.action LIKE ?"); values.push(`%${action}%`); }
  if (entityType) { conditions.push("al.entity_type = ?"); values.push(entityType); }
  if (from) { conditions.push("al.created_at >= ?"); values.push(from); }
  if (to) { conditions.push("al.created_at <= ?"); values.push(to); }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.old_value, al.new_value,
            al.reason, al.ip_address, al.created_at, u.username as user_username
     FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...values, pageSize, (page - 1) * pageSize).all();

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM audit_logs al ${whereClause}`)
    .bind(...values).first<{ n: number }>();

  return c.json({ data: results, page, pageSize, total: countRow?.n ?? 0 });
});

audit.get("/action-types", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT DISTINCT action FROM audit_logs ORDER BY action`).all();
  return c.json({ data: results });
});

export default audit;
