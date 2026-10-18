import type { Context } from "hono";
import type { AppBindings } from "../index";

export function clientIp(c: Context<AppBindings>): string {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// نافذة ثابتة: يسمح بعدد limit من الطلبات لكل windowSec ثانية لنفس المفتاح.
// يُرجع true إن كان مسموحًا. المفتاح مُهاش (لا نخزّن IP خام).
export async function rateLimit(
  c: Context<AppBindings>,
  name: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const key = `${name}:${await sha256Hex(clientIp(c) + c.env.JWT_SECRET)}`;
  await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`
  ).bind(key, windowStart).run();
  const row = await c.env.DB.prepare(`SELECT count FROM rate_limits WHERE key = ? AND window_start = ?`)
    .bind(key, windowStart).first<{ count: number }>();
  // تنظيف انتهازي للنوافذ القديمة
  if (Math.random() < 0.02) {
    await c.env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(now - 86400).run();
  }
  return (row?.count ?? 1) <= limit;
}
