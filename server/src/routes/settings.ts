// worker/src/routes/settings.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import { uploadFileToGas } from "../lib/gasClient";
import type { AppBindings } from "../index";

const settings = new Hono<AppBindings>();

// عرض إعدادات المدرسة متاح للعامة (الشعار والاسم يظهران في الموقع العام)
// لكن لا تُعرض أي بيانات حساسة هنا أصلاً (school_settings لا تحوي بيانات شخصية)
settings.get("/", async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM school_settings WHERE id = 'main'`).first();
  return c.json({ data: row });
});

settings.use("/*", authMiddleware);

const updateSettingsSchema = z.object({
  schoolNameAr: z.string().min(2).optional(),
  schoolNameEn: z.string().optional(),
  ministry: z.string().optional(),
  educationDepartment: z.string().optional(),
  governorate: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  currentAcademicYearId: z.string().optional(),
  currentTermId: z.string().optional(),
});

settings.put("/", permissionMiddleware("settings.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }

  const before = await c.env.DB.prepare(`SELECT * FROM school_settings WHERE id = 'main'`).first();

  const fields = parsed.data;
  const columnMap: Record<string, string> = {
    schoolNameAr: "school_name_ar", schoolNameEn: "school_name_en", ministry: "ministry",
    educationDepartment: "education_department", governorate: "governorate", address: "address",
    phone: "phone", email: "email", primaryColor: "primary_color",
    currentAcademicYearId: "current_academic_year_id", currentTermId: "current_term_id",
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    setClauses.push(`${columnMap[key]} = ?`);
    values.push(value);
  }

  if (setClauses.length === 0) {
    return c.json({ error: "NO_FIELDS_TO_UPDATE" }, 400);
  }

  setClauses.push(`updated_at = datetime('now')`);
  await c.env.DB.prepare(`UPDATE school_settings SET ${setClauses.join(", ")} WHERE id = 'main'`)
    .bind(...values)
    .run();

  const userId = c.get("userId") as string;
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
     VALUES (?, ?, 'UPDATE_SETTINGS', 'school_settings', 'main', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), userId, JSON.stringify(before), JSON.stringify(fields))
    .run();

  return c.json({ success: true });
});

// رفع شعار المدرسة عبر GAS (بديل R2)
const uploadLogoSchema = z.object({
  fileName: z.string().min(1),
  base64Data: z.string().min(1),
  mimeType: z.string().min(1),
});

settings.post("/logo", permissionMiddleware("settings.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = uploadLogoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }

  const result = await uploadFileToGas(c.env, { ...parsed.data, subFolder: "Logos" });

  await c.env.DB.prepare(
    `INSERT INTO files (id, entity_type, entity_id, drive_file_id, view_url, uploaded_by, created_at)
     VALUES (?, 'logo', 'main', ?, ?, ?, datetime('now'))`
  )
    .bind(nanoid(), result.driveFileId, result.viewUrl, c.get("userId"))
    .run();

  await c.env.DB.prepare(`UPDATE school_settings SET logo_file_id = ?, updated_at = datetime('now') WHERE id = 'main'`)
    .bind(result.driveFileId)
    .run();

  return c.json({ success: true, ...result });
});

export default settings;
