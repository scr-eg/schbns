// worker/src/routes/auth.ts
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { signAccessToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";
import { sendEmailViaGas } from "../lib/gasClient";
import type { AppBindings } from "../index";

const auth = new Hono<AppBindings>();

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const MAX_FAILED_ATTEMPTS = 5;

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }
  const { username, password } = parsed.data;

  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.password_hash, u.status, u.failed_login_attempts,
            u.linked_entity_type, u.linked_entity_id, r.code as role_code
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? AND u.deleted_at IS NULL`
  )
    .bind(username)
    .first<{
      id: string; username: string; password_hash: string; status: string;
      failed_login_attempts: number; linked_entity_type: string | null;
      linked_entity_id: string | null; role_code: string;
    }>();

  // رسالة خطأ موحّدة لمنع User Enumeration
  const genericError = { error: "INVALID_CREDENTIALS", message: "اسم المستخدم أو كلمة المرور غير صحيحة" };

  if (!user) return c.json(genericError, 401);
  if (user.status !== "active") {
    return c.json({ error: "ACCOUNT_LOCKED", message: "الحساب مقفل، تواصل مع إدارة النظام" }, 403);
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    const attempts = user.failed_login_attempts + 1;
    const newStatus = attempts >= MAX_FAILED_ATTEMPTS ? "locked" : "active";
    await c.env.DB.prepare(`UPDATE users SET failed_login_attempts = ?, status = ? WHERE id = ?`)
      .bind(attempts, newStatus, user.id)
      .run();
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (id, user_id, action, reason, created_at) VALUES (?, ?, 'LOGIN_FAILED', ?, datetime('now'))`
    )
      .bind(nanoid(), user.id, `attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`)
      .run();
    return c.json(genericError, 401);
  }

  // نجاح: إعادة تصفير المحاولات + تسجيل آخر دخول
  await c.env.DB.prepare(
    `UPDATE users SET failed_login_attempts = 0, last_login_at = datetime('now') WHERE id = ?`
  )
    .bind(user.id)
    .run();

  const accessToken = await signAccessToken(
    {
      sub: user.id,
      roleCode: user.role_code,
      linkedEntityType: user.linked_entity_type ?? undefined,
      linkedEntityId: user.linked_entity_id ?? undefined,
    },
    c.env.JWT_SECRET
  );

  // Refresh token (عشوائي) يُخزَّن كـ hash في جدول sessions
  const refreshToken = nanoid(48);
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 يوم

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      nanoid(),
      user.id,
      refreshHash,
      c.req.header("User-Agent") ?? null,
      c.req.header("CF-Connecting-IP") ?? null,
      expiresAt
    )
    .run();

  setCookie(c, "access_token", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 15 * 60,
  });
  setCookie(c, "refresh_token", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/api/auth/refresh",
    maxAge: 30 * 24 * 60 * 60,
  });

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, created_at) VALUES (?, ?, 'LOGIN_SUCCESS', datetime('now'))`
  )
    .bind(nanoid(), user.id)
    .run();

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      roleCode: user.role_code,
    },
  });
});

auth.post("/logout", async (c) => {
  const refreshToken = getCookie(c, "refresh_token");
  if (refreshToken) {
    // إبطال كل الجلسات المطابقة (تبسيطًا؛ في نسخة أدق يُقارن الـ hash لكل جلسة نشطة للمستخدم)
    const userId = c.get("userId") as string | undefined;
    if (userId) {
      await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
    }
  }
  deleteCookie(c, "access_token", { path: "/" });
  deleteCookie(c, "refresh_token", { path: "/api/auth/refresh" });
  return c.json({ success: true });
});

// إرجاع بيانات المستخدم الحالي (يُستخدم لتحديد التوجيه بعد أي إعادة تحميل للصفحة)
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, r.code as role_code, u.linked_entity_type, u.linked_entity_id
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL`
  )
    .bind(userId)
    .first();

  if (!user) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ user });
});

// تجديد الـ Access Token باستخدام الـ Refresh Token (Cookie منفصل بمسار مقيّد)
auth.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, "refresh_token");
  if (!refreshToken) return c.json({ error: "NO_REFRESH_TOKEN" }, 401);

  // ملاحظة أداء: في نسخة Production يُفضَّل تخزين معرّف الجلسة في Cookie منفصل
  // بدل مطابقة الـ hash عبر كل الجلسات، لتفادي O(n) بحث. هنا نسخة مبسطة وواضحة.
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, r.code as role_code,
            u.linked_entity_type, u.linked_entity_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.expires_at > datetime('now')`
  ).all<{
    id: string; user_id: string; refresh_token_hash: string; expires_at: string;
    role_code: string; linked_entity_type: string | null; linked_entity_id: string | null;
  }>();

  let matched: (typeof results)[number] | undefined;
  for (const session of results) {
    if (await bcrypt.compare(refreshToken, session.refresh_token_hash)) {
      matched = session;
      break;
    }
  }

  if (!matched) return c.json({ error: "INVALID_REFRESH_TOKEN" }, 401);

  const accessToken = await signAccessToken(
    {
      sub: matched.user_id,
      roleCode: matched.role_code,
      linkedEntityType: matched.linked_entity_type ?? undefined,
      linkedEntityId: matched.linked_entity_id ?? undefined,
    },
    c.env.JWT_SECRET
  );

  setCookie(c, "access_token", accessToken, {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 15 * 60,
  });

  return c.json({ success: true });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
});

auth.post("/change-password", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }

  const userId = c.get("userId") as string;
  const user = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ password_hash: string }>();

  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.password_hash))) {
    return c.json({ error: "INVALID_CURRENT_PASSWORD" }, 400);
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(newHash, userId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, created_at) VALUES (?, ?, 'PASSWORD_CHANGED', datetime('now'))`
  )
    .bind(nanoid(), userId)
    .run();

  // إبطال كل الجلسات الأخرى إجباريًا بعد تغيير كلمة المرور
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();

  return c.json({ success: true, message: "تم تغيير كلمة المرور بنجاح، الرجاء تسجيل الدخول مجددًا" });
});

// ---------- نسيان / استعادة كلمة المرور (عبر GAS + Gmail، مجاني بديل عن SMTP خارجي) ----------

const forgotPasswordSchema = z.object({ email: z.string().email() });

auth.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const user = await c.env.DB.prepare(
    `SELECT id, username, email FROM users WHERE email = ? AND deleted_at IS NULL`
  )
    .bind(parsed.data.email)
    .first<{ id: string; username: string; email: string }>();

  // ⚠️ نُرجع نجاحًا دائمًا (حتى لو البريد غير موجود) لمنع User Enumeration
  if (user) {
    const resetToken = nanoid(32);
    const resetHash = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 دقيقة

    await c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, 'password_reset', ?, datetime('now'))`
    )
      .bind(nanoid(), user.id, resetHash, expiresAt)
      .run();

    const resetLink = `${c.env.FRONTEND_ORIGIN}/reset-password?uid=${user.id}&token=${resetToken}`;

    // إرسال البريد عبر GAS (Gmail مجاني) بدل خدمة SMTP خارجية مدفوعة
    await sendEmailViaGas(c.env, {
      to: user.email,
      subject: "طلب استعادة كلمة المرور",
      body: `مرحبًا ${user.username}،\n\nاضغط الرابط التالي خلال 30 دقيقة لإعادة تعيين كلمة المرور:\n${resetLink}\n\nإن لم تطلب ذلك، تجاهل هذه الرسالة.`,
    }).catch(() => null); // لا نُفشل الطلب إن تعطّل الإرسال؛ الأمان أولى من كشف الخطأ

    await c.env.DB.prepare(
      `INSERT INTO audit_logs (id, user_id, action, created_at) VALUES (?, ?, 'PASSWORD_RESET_REQUESTED', datetime('now'))`
    )
      .bind(nanoid(), user.id)
      .run();
  }

  return c.json({ success: true, message: "إذا كان البريد صحيحًا، سيصلك رابط استعادة كلمة المرور" });
});

const resetPasswordSchema = z.object({
  userId: z.string(),
  token: z.string(),
  newPassword: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
});

auth.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const { userId, token, newPassword } = parsed.data;
  const session = await c.env.DB.prepare(
    `SELECT id, refresh_token_hash FROM sessions
     WHERE user_id = ? AND user_agent = 'password_reset' AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(userId)
    .first<{ id: string; refresh_token_hash: string }>();

  if (!session || !(await bcrypt.compare(token, session.refresh_token_hash))) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, status = 'active', failed_login_attempts = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(newHash, userId)
    .run();

  // إبطال كل جلسات المستخدم (بما فيها رمز الاستعادة نفسه)
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, created_at) VALUES (?, ?, 'PASSWORD_RESET_COMPLETED', datetime('now'))`
  )
    .bind(nanoid(), userId)
    .run();

  return c.json({ success: true, message: "تم تعيين كلمة المرور الجديدة بنجاح" });
});

export default auth;
