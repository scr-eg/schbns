// worker/src/routes/grading.ts
// محرك إعدادات الدرجات: يسمح للأدمن/الكنترول بتعريف مكوّنات كل مادة
// (أعمال سنة، امتحان، أنشطة...) بدون افتراض نظام تقييم ثابت في الكود.
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const grading = new Hono<AppBindings>();
grading.use("*", authMiddleware);

// ---------- مكوّنات الدرجة ----------
grading.get("/components", permissionMiddleware(["exams.read", "exams.manage"]), async (c) => {
  const subjectId = c.req.query("subjectId");
  const gradeId = c.req.query("gradeId");
  const academicYearId = c.req.query("academicYearId");
  const termId = c.req.query("termId");

  if (!subjectId || !gradeId || !academicYearId || !termId) {
    return c.json({ error: "MISSING_PARAMS", message: "subjectId, gradeId, academicYearId, termId مطلوبة جميعًا" }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM grade_components
     WHERE subject_id = ? AND grade_id = ? AND academic_year_id = ? AND term_id = ?
     ORDER BY order_index`
  )
    .bind(subjectId, gradeId, academicYearId, termId)
    .all();

  return c.json({ data: results });
});

const componentSchema = z.object({
  subjectId: z.string(),
  gradeId: z.string(),
  academicYearId: z.string(),
  termId: z.string(),
  componentName: z.string().min(1),
  maxScore: z.number().positive(),
  orderIndex: z.number().int().default(0),
});

grading.post("/components", permissionMiddleware("exams.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = componentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const id = nanoid();
  const d = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO grade_components (id, subject_id, grade_id, academic_year_id, term_id, component_name, max_score, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, d.subjectId, d.gradeId, d.academicYearId, d.termId, d.componentName, d.maxScore, d.orderIndex)
    .run();

  return c.json({ id }, 201);
});

grading.delete("/components/:id", permissionMiddleware("exams.manage"), async (c) => {
  // ⚠️ لا يُسمح بحذف مكوّن له درجات مُدخلة بالفعل لتفادي فقدان بيانات نتائج معتمدة
  const id = c.req.param("id");
  const used = await c.env.DB.prepare(`SELECT 1 FROM result_details WHERE grade_component_id = ? LIMIT 1`)
    .bind(id)
    .first();
  if (used) {
    return c.json({ error: "COMPONENT_IN_USE", message: "لا يمكن حذف مكوّن دخلت به درجات بالفعل" }, 409);
  }
  await c.env.DB.prepare(`DELETE FROM grade_components WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});

// ---------- جدول التقديرات (Grade Scale) ----------
grading.get("/scale", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM grade_scale ORDER BY order_index`).all();
  return c.json({ data: results });
});

const scaleSchema = z.object({
  minPercentage: z.number().min(0),
  maxPercentage: z.number().max(100.01),
  labelAr: z.string().min(1),
  labelEn: z.string().optional(),
  orderIndex: z.number().int(),
});

grading.put("/scale", permissionMiddleware("settings.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ scale: z.array(scaleSchema).min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  // استبدال الجدول بالكامل ذرّيًا (حذف القديم + إدراج الجديد في batch واحدة)
  const statements = [
    c.env.DB.prepare(`DELETE FROM grade_scale`),
    ...parsed.data.scale.map((s) =>
      c.env.DB.prepare(
        `INSERT INTO grade_scale (id, min_percentage, max_percentage, label_ar, label_en, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(nanoid(), s.minPercentage, s.maxPercentage, s.labelAr, s.labelEn ?? null, s.orderIndex)
    ),
  ];

  await c.env.DB.batch(statements);
  return c.json({ success: true });
});

export default grading;
