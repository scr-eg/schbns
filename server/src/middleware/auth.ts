// worker/src/middleware/auth.ts
import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyAccessToken } from "../lib/jwt";
import type { AppBindings } from "../index";

/**
 * يتحقق من وجود Access Token صالح (Cookie أو Authorization header)،
 * ويحقن بيانات المستخدم (id, roleCode) في الـ Context لاستخدامها لاحقًا
 * في rbacMiddleware وفي كل route.
 */
export async function authMiddleware(c: Context<AppBindings>, next: Next) {
  const authHeader = c.req.header("Authorization");
  const cookieToken = getCookie(c, "access_token");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

  if (!token) {
    return c.json({ error: "UNAUTHENTICATED", message: "يجب تسجيل الدخول أولاً" }, 401);
  }

  try {
    const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set("userId", payload.sub);
    c.set("roleCode", payload.roleCode);
    c.set("linkedEntityType", payload.linkedEntityType);
    c.set("linkedEntityId", payload.linkedEntityId);
    await next();
  } catch {
    return c.json({ error: "INVALID_TOKEN", message: "جلسة غير صالحة، الرجاء تسجيل الدخول مجددًا" }, 401);
  }
}

/**
 * يقيّد الوصول لأدوار محددة فقط.
 * مثال: rbacMiddleware(["super_admin", "exam_controller"])
 *
 * ⚠️ هذا هو التحقق الحقيقي من الصلاحية (على مستوى الـ API)،
 * وليس مجرد إخفاء زر في الواجهة.
 *
 * ملاحظة: هذا التحقق يعتمد على "الدور" الثابت (سريع، مناسب للحالات البسيطة).
 * للتحكم الدقيق القابل للتخصيص من الأدمن دون تعديل الكود، استخدم permissionMiddleware أدناه.
 */
export function rbacMiddleware(allowedRoles: string[]) {
  return async (c: Context<AppBindings>, next: Next) => {
    const roleCode = c.get("roleCode") as string | undefined;
    if (!roleCode || !allowedRoles.includes(roleCode)) {
      await logForbiddenAttempt(c);
      return c.json({ error: "FORBIDDEN", message: "لا تملك صلاحية الوصول لهذا المورد" }, 403);
    }
    await next();
  };
}

/**
 * يتحقق من امتلاك المستخدم لإحدى الصلاحيات المحددة عبر جدول role_permissions الفعلي في D1،
 * بحيث يستطيع super_admin تعديل من يملك ماذا دون تعديل الكود إطلاقًا.
 * مثال: permissionMiddleware("results.approve")
 * أو: permissionMiddleware(["students.read", "students.crud"]) — تكفي إحداهما (CRUD تتضمن الحق بالقراءة)
 */
export function permissionMiddleware(permissionCodes: string | string[]) {
  const codes = Array.isArray(permissionCodes) ? permissionCodes : [permissionCodes];

  return async (c: Context<AppBindings>, next: Next) => {
    const roleCode = c.get("roleCode") as string | undefined;
    if (!roleCode) {
      await logForbiddenAttempt(c);
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    const placeholders = codes.map(() => "?").join(",");
    const row = await c.env.DB.prepare(
      `SELECT 1 FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.code = ? AND p.code IN (${placeholders})
       LIMIT 1`
    )
      .bind(roleCode, ...codes)
      .first();

    if (!row) {
      await logForbiddenAttempt(c, `missing permission(s)=${codes.join("|")}`);
      return c.json({ error: "FORBIDDEN", message: "لا تملك صلاحية الوصول لهذا المورد" }, 403);
    }
    await next();
  };
}

async function logForbiddenAttempt(c: Context<AppBindings>, extra?: string) {
  const userId = c.get("userId") as string | undefined;
  const roleCode = c.get("roleCode") as string | undefined;
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, reason, created_at)
     VALUES (?, ?, 'FORBIDDEN_ACCESS_ATTEMPT', ?, ?, datetime('now'))`
  )
    .bind(crypto.randomUUID(), userId ?? null, c.req.path, extra ?? `role=${roleCode ?? "unknown"}`)
    .run();
}
