// worker/src/routes/public.ts
// إحصائيات عامة للموقع الرئيسي — أرقام إجمالية فقط، بدون أي بيانات شخصية
import { Hono } from "hono";
import type { AppBindings } from "../index";

const publicRoutes = new Hono<AppBindings>();

publicRoutes.get("/stats", async (c) => {
  const [studentsCount, teachersCount, classesCount, stagesCount, settings] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM students WHERE deleted_at IS NULL`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM teachers WHERE deleted_at IS NULL`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM sections`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM stages`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT founded_year FROM school_settings WHERE id = 'main'`).first<{ founded_year: number | null }>(),
  ]);

  const currentYear = new Date().getFullYear();
  const yearsOfExperience = settings?.founded_year ? currentYear - settings.founded_year : null;

  return c.json({
    studentsCount: studentsCount?.n ?? 0,
    teachersCount: teachersCount?.n ?? 0,
    classesCount: classesCount?.n ?? 0,
    stagesCount: stagesCount?.n ?? 0,
    yearsOfExperience,
  });
});

// تقويم دراسي مبسّط: يعتمد على الترمين الحاليين وتواريخهما (يُستكمل بجدول مستقل لاحقًا عند الحاجة لمرونة أكبر)
publicRoutes.get("/academic-calendar", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.name, t.order_index, ay.name as academic_year, ay.start_date, ay.end_date
     FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE ay.is_current = 1 ORDER BY t.order_index`
  ).all();
  return c.json({ data: results });
});

publicRoutes.get("/stages", async (c) => {
  const stagesResult = await c.env.DB.prepare(
    `SELECT id, code, name_ar, name_en, order_index FROM stages ORDER BY order_index`
  ).all<{ id: string; code: string; name_ar: string; name_en: string; order_index: number }>();

  const gradesResult = await c.env.DB.prepare(
    `SELECT id, stage_id, name_ar, name_en, order_index FROM grades ORDER BY order_index`
  ).all<{ id: string; stage_id: string; name_ar: string; name_en: string; order_index: number }>();

  const data = stagesResult.results.map((stage) => ({
    ...stage,
    grades: gradesResult.results.filter((g) => g.stage_id === stage.id),
  }));

  return c.json({ data });
});

export default publicRoutes;
