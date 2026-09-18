// worker/src/routes/import.ts
// استيراد الطلاب: الفرونت يحلّل ملف Excel/CSV عبر SheetJS ويرسل الصفوف كـ JSON.
// هذا المسار يتحقق (Validate) أولاً، ثم يستورد (Commit) دفعة واحدة ذرّيًا.
import { Hono, Context } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const importRoutes = new Hono<AppBindings>();
importRoutes.use("*", authMiddleware, permissionMiddleware("students.crud"));

const rowSchema = z.object({
  studentCode: z.string().min(1, "كود الطالب مطلوب"),
  fullName: z.string().min(2, "اسم الطالب مطلوب"),
  nationalId: z.string().optional(),
  gradeCode: z.string().optional(), // اختياري: لمطابقة الصف من كود الصف إن أُرسل
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
});

interface RowResult {
  rowIndex: number;
  status: "valid" | "error";
  errors?: string[];
  data?: z.infer<typeof rowSchema>;
}

async function validateRows(c: Context<AppBindings>, rows: unknown[]): Promise<RowResult[]> {
  const existingCodesResult = await c.env.DB.prepare(`SELECT student_code FROM students`).all<{ student_code: string }>();
  const existingCodes = new Set(existingCodesResult.results.map((r) => r.student_code));
  const seenInBatch = new Set<string>();

  return rows.map((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      return {
        rowIndex: index + 1,
        status: "error" as const,
        errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }

    const errors: string[] = [];
    if (existingCodes.has(parsed.data.studentCode)) {
      errors.push(`كود الطالب "${parsed.data.studentCode}" مستخدم بالفعل في قاعدة البيانات`);
    }
    if (seenInBatch.has(parsed.data.studentCode)) {
      errors.push(`كود الطالب "${parsed.data.studentCode}" مكرر داخل ملف الاستيراد نفسه`);
    }
    seenInBatch.add(parsed.data.studentCode);

    return errors.length > 0
      ? { rowIndex: index + 1, status: "error" as const, errors }
      : { rowIndex: index + 1, status: "valid" as const, data: parsed.data };
  });
}

// ---------- خطوة المعاينة والتحقق (Preview + Validation) ----------
importRoutes.post("/students/validate", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return c.json({ error: "INVALID_PAYLOAD", message: "يجب إرسال rows كمصفوفة" }, 400);
  }
  if (body.rows.length > 2000) {
    return c.json({ error: "TOO_MANY_ROWS", message: "الحد الأقصى 2000 صف لكل عملية استيراد" }, 400);
  }

  const results = await validateRows(c, body.rows);
  const validCount = results.filter((r) => r.status === "valid").length;
  const errorCount = results.length - validCount;

  return c.json({ results, summary: { total: results.length, validCount, errorCount } });
});

// ---------- خطوة التنفيذ (Commit) — عملية واحدة ذرّية عبر D1 batch ----------
importRoutes.post("/students/commit", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return c.json({ error: "INVALID_PAYLOAD" }, 400);
  }

  // إعادة التحقق فورًا قبل الإدراج (لتفادي تغييرات حدثت بين المعاينة والتنفيذ)
  const revalidated = await validateRows(c, body.rows);
  const invalidRows = revalidated.filter((r) => r.status === "error");
  if (invalidRows.length > 0) {
    return c.json({
      error: "VALIDATION_FAILED",
      message: "توجد صفوف غير صالحة، لم يُستورد أي شيء (Rollback تلقائي)",
      invalidRows,
    }, 400);
  }

  const userId = c.get("userId");
  const now = new Date().toISOString();

  // بناء كل عبارات الإدراج كدفعة واحدة (D1 batch = ذرّية: تنجح كلها أو تفشل كلها)
  const statements = revalidated.map((r) => {
    const d = r.data!;
    const id = nanoid();
    return c.env.DB.prepare(
      `INSERT INTO students (id, student_code, full_name, birth_date, gender, status, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, 'new', 0, ?)`
    ).bind(id, d.studentCode, d.fullName, d.birthDate ?? null, d.gender ?? null, now);
  });

  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    return c.json({
      error: "IMPORT_FAILED",
      message: "فشل الاستيراد، لم يتم حفظ أي بيانات (Rollback تلقائي)",
      details: String(err),
    }, 500);
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, new_value, created_at)
     VALUES (?, ?, 'BULK_IMPORT_STUDENTS', 'student', ?, datetime('now'))`
  )
    .bind(nanoid(), userId, JSON.stringify({ count: revalidated.length }))
    .run();

  return c.json({ success: true, importedCount: revalidated.length });
});

export default importRoutes;
