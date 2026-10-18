import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import { clientIp, rateLimit, sha256Hex } from "../lib/rateLimit";
import type { AppBindings } from "../index";

const analytics = new Hono<AppBindings>();

function cairoDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d); // YYYY-MM-DD
}

function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

// تسجيل زيارة (عام، بدون كوكيز، بدون IP خام). البصمة تتغير يوميًا فلا يمكن تتبع الزائر عبر الأيام.
const trackSchema = z.object({ path: z.string().max(200).regex(/^\/[\w\-/.%]*$/) });
analytics.post("/track", async (c) => {
  const parsed = trackSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false }, 400);
  if (!(await rateLimit(c, "track", 120, 3600))) return c.json({ ok: false }, 429);
  const ua = c.req.header("User-Agent") ?? "";
  if (/bot|crawler|spider|headless/i.test(ua)) return c.json({ ok: true, skipped: true });
  const date = cairoDate();
  const visitor = await sha256Hex(`${clientIp(c)}|${ua}|${date}|${c.env.JWT_SECRET}`);
  await c.env.DB.prepare(
    `INSERT INTO site_visits (visit_date, visitor_hash, path, device) VALUES (?, ?, ?, ?)`
  ).bind(date, visitor, parsed.data.path, deviceOf(ua)).run();
  return c.json({ ok: true });
});

// لوحة الإحصائيات — للمدير العام فقط (analytics.read)
analytics.get("/visitors", authMiddleware, permissionMiddleware("analytics.read"), async (c) => {
  const range = c.req.query("range") ?? "daily";
  const days = range === "monthly" ? 365 : range === "weekly" ? 84 : 30;
  const since = cairoDate(new Date(Date.now() - days * 86400000));
  // يومي: كل يوم | أسبوعي: أسابيع (بداية الأسبوع الاثنين) | شهري: YYYY-MM
  const bucket =
    range === "monthly"
      ? "substr(visit_date,1,7)"
      : range === "weekly"
        ? "date(visit_date, '-' || ((strftime('%w', visit_date) + 6) % 7) || ' days')"
        : "visit_date";

  const series = await c.env.DB.prepare(
    `SELECT ${bucket} AS bucket, COUNT(*) AS pageViews, COUNT(DISTINCT visitor_hash) AS uniqueVisitors
     FROM site_visits WHERE visit_date >= ? GROUP BY bucket ORDER BY bucket`
  ).bind(since).all();

  const today = cairoDate();
  const weekAgo = cairoDate(new Date(Date.now() - 6 * 86400000));
  const monthAgo = cairoDate(new Date(Date.now() - 29 * 86400000));
  const kpi = async (from: string) =>
    (await c.env.DB.prepare(
      `SELECT COUNT(*) AS pageViews, COUNT(DISTINCT visitor_hash) AS uniqueVisitors FROM site_visits WHERE visit_date >= ?`
    ).bind(from).first<{ pageViews: number; uniqueVisitors: number }>()) ?? { pageViews: 0, uniqueVisitors: 0 };

  const topPages = await c.env.DB.prepare(
    `SELECT path, COUNT(*) AS views FROM site_visits WHERE visit_date >= ? GROUP BY path ORDER BY views DESC LIMIT 10`
  ).bind(monthAgo).all();
  const devices = await c.env.DB.prepare(
    `SELECT device, COUNT(*) AS views FROM site_visits WHERE visit_date >= ? GROUP BY device`
  ).bind(monthAgo).all();

  return c.json({
    range,
    series: series.results,
    totals: { today: await kpi(today), last7Days: await kpi(weekAgo), last30Days: await kpi(monthAgo) },
    topPages: topPages.results,
    devices: devices.results,
  });
});

export default analytics;
