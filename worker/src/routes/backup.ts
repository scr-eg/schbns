// worker/src/routes/backup.ts
import { Hono } from "hono";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const backup = new Hono<AppBindings>();
backup.use("*", authMiddleware, permissionMiddleware("backup.manage"));

backup.get("/logs", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, triggered_by, status, file_id, created_at FROM backup_logs ORDER BY created_at DESC LIMIT 50`
  ).all();
  return c.json({ data: results });
});

export default backup;
