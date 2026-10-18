// worker/src/routes/academic.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const academic = new Hono<AppBindings>();
academic.use("*", authMiddleware);

academic.get("/stages", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM stages ORDER BY order_index`).all();
  return c.json({ data: results });
});

academic.get("/grades", async (c) => {
  const stageId = c.req.query("stageId");
  const query = stageId
    ? c.env.DB.prepare(`SELECT * FROM grades WHERE stage_id = ? ORDER BY order_index`).bind(stageId)
    : c.env.DB.prepare(`SELECT * FROM grades ORDER BY order_index`);
  const { results } = await query.all();
  return c.json({ data: results });
});

academic.get("/classes", permissionMiddleware(["classes.read", "classes.crud"]), async (c) => {
  const academicYearId = c.req.query("academicYearId");
  const query = academicYearId
    ? c.env.DB.prepare(
        `SELECT cl.*, g.name_ar as grade_name FROM classes cl JOIN grades g ON g.id = cl.grade_id
         WHERE cl.academic_year_id = ? ORDER BY g.order_index`
      ).bind(academicYearId)
    : c.env.DB.prepare(`SELECT cl.*, g.name_ar as grade_name FROM classes cl JOIN grades g ON g.id = cl.grade_id`);
  const { results } = await query.all();
  return c.json({ data: results });
});

academic.get("/sections", permissionMiddleware(["classes.read", "classes.crud"]), async (c) => {
  const classId = c.req.query("classId");
  const query = classId
    ? c.env.DB.prepare(`SELECT * FROM sections WHERE class_id = ?`).bind(classId)
    : c.env.DB.prepare(`SELECT * FROM sections`);
  const { results } = await query.all();
  return c.json({ data: results });
});

academic.get("/subjects", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM subjects ORDER BY name_ar`).all();
  return c.json({ data: results });
});

academic.get("/terms", async (c) => {
  const academicYearId = c.req.query("academicYearId");
  const query = academicYearId
    ? c.env.DB.prepare(`SELECT * FROM terms WHERE academic_year_id = ? ORDER BY order_index`).bind(academicYearId)
    : c.env.DB.prepare(`SELECT * FROM terms ORDER BY order_index`);
  const { results } = await query.all();
  return c.json({ data: results });
});

academic.get("/academic-years", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM academic_years ORDER BY start_date DESC`).all();
  return c.json({ data: results });
});

const classSchema = z.object({ gradeId: z.string(), academicYearId: z.string(), nameAr: z.string().min(1) });

academic.post("/classes", permissionMiddleware("classes.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = classSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  await c.env.DB.prepare(`INSERT INTO classes (id, grade_id, academic_year_id, name_ar) VALUES (?, ?, ?, ?)`)
    .bind(id, parsed.data.gradeId, parsed.data.academicYearId, parsed.data.nameAr)
    .run();
  return c.json({ id }, 201);
});

const sectionSchema = z.object({ classId: z.string(), name: z.string().min(1), capacity: z.number().optional() });

academic.post("/sections", permissionMiddleware("classes.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = sectionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  await c.env.DB.prepare(`INSERT INTO sections (id, class_id, name, capacity) VALUES (?, ?, ?, ?)`)
    .bind(id, parsed.data.classId, parsed.data.name, parsed.data.capacity ?? null)
    .run();
  return c.json({ id }, 201);
});

const subjectSchema = z.object({
  code: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().optional(),
  subjectType: z.enum(["main", "additional", "activity"]).default("main"),
});

academic.post("/subjects", permissionMiddleware("subjects.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = subjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  try {
    await c.env.DB.prepare(
      `INSERT INTO subjects (id, code, name_ar, name_en, subject_type) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, parsed.data.code, parsed.data.nameAr, parsed.data.nameEn ?? null, parsed.data.subjectType)
      .run();
  } catch {
    return c.json({ error: "DUPLICATE_SUBJECT_CODE" }, 409);
  }
  return c.json({ id }, 201);
});

export default academic;
