// worker/src/routes/students.ts
import { Hono, Context } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const students = new Hono<AppBindings>();

students.use("*", authMiddleware);

// ---------- قائمة الطلاب مع فلاتر بحث حقيقية ----------
students.get(
  "/",
  permissionMiddleware(["students.read", "students.read_own", "students.read_child", "students.crud"]),
  async (c) => {
    const page = Number(c.req.query("page") ?? "1");
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const search = c.req.query("q");
    const stageId = c.req.query("stageId");
    const status = c.req.query("status");

    const conditions: string[] = ["s.deleted_at IS NULL"];
    const values: unknown[] = [];

    if (search) {
      conditions.push("(s.full_name LIKE ? OR s.student_code LIKE ?)");
      values.push(`%${search}%`, `%${search}%`);
    }
    if (stageId) {
      conditions.push("s.current_stage_id = ?");
      values.push(stageId);
    }
    if (status) {
      conditions.push("s.status = ?");
      values.push(status);
    }

    const whereClause = conditions.join(" AND ");

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.student_code, s.full_name, s.status, s.gender, s.current_stage_id,
              st.name_ar as stage_name
       FROM students s LEFT JOIN stages st ON st.id = s.current_stage_id
       WHERE ${whereClause}
       ORDER BY s.full_name LIMIT ? OFFSET ?`
    )
      .bind(...values, pageSize, offset)
      .all();

    const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM students s WHERE ${whereClause}`)
      .bind(...values)
      .first<{ n: number }>();

    return c.json({ data: results, page, pageSize, total: countRow?.n ?? 0 });
  }
);

// ---------- ملف تعريف كامل لطالب واحد ----------
students.get("/:id", permissionMiddleware(["students.read", "students.read_own", "students.read_child", "students.crud"]), async (c) => {
  const id = c.req.param("id");
  const student = await c.env.DB.prepare(
    `SELECT s.*, st.name_ar as stage_name
     FROM students s LEFT JOIN stages st ON st.id = s.current_stage_id
     WHERE s.id = ? AND s.deleted_at IS NULL`
  )
    .bind(id)
    .first();

  if (!student) return c.json({ error: "NOT_FOUND" }, 404);

  const parents = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.phone, p.email, ps.relationship
     FROM parents p JOIN parent_student ps ON ps.parent_id = p.id
     WHERE ps.student_id = ?`
  )
    .bind(id)
    .all();

  const enrollment = await c.env.DB.prepare(
    `SELECT sc.id, sec.name as section_name, cl.name_ar as class_name, ay.name as academic_year
     FROM student_classes sc
     JOIN sections sec ON sec.id = sc.section_id
     JOIN classes cl ON cl.id = sec.class_id
     JOIN academic_years ay ON ay.id = sc.academic_year_id
     WHERE sc.student_id = ? ORDER BY ay.start_date DESC`
  )
    .bind(id)
    .all();

  return c.json({ data: student, parents: parents.results, enrollment: enrollment.results });
});

// ---------- إنشاء طالب ----------
const studentSchema = z.object({
  studentCode: z.string().min(2),
  fullName: z.string().min(2),
  birthDate: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  currentStageId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

students.post("/", permissionMiddleware("students.crud"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = studentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const { studentCode, fullName, birthDate, gender, currentStageId, address, phone } = parsed.data;
  const id = nanoid();

  try {
    await c.env.DB.prepare(
      `INSERT INTO students (id, student_code, full_name, birth_date, gender, current_stage_id, address, phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`
    )
      .bind(id, studentCode, fullName, birthDate ?? null, gender ?? null, currentStageId ?? null, address ?? null, phone ?? null)
      .run();
  } catch {
    return c.json({ error: "DUPLICATE_STUDENT_CODE", message: "كود الطالب مستخدم بالفعل" }, 409);
  }

  await logAudit(c, "CREATE_STUDENT", id, parsed.data);
  return c.json({ id, message: "تم إنشاء الطالب بنجاح" }, 201);
});

// ---------- تعديل بيانات طالب ----------
const updateStudentSchema = studentSchema.partial().extend({
  status: z.enum(["new", "enrolled", "transferred_in", "transferred_out", "passed", "failed", "expelled", "graduated"]).optional(),
});

students.put("/:id", permissionMiddleware("students.crud"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const columnMap: Record<string, string> = {
    studentCode: "student_code", fullName: "full_name", birthDate: "birth_date", gender: "gender",
    currentStageId: "current_stage_id", address: "address", phone: "phone", status: "status",
  };
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    setClauses.push(`${columnMap[key]} = ?`);
    values.push(value);
  }
  if (setClauses.length === 0) return c.json({ error: "NO_FIELDS_TO_UPDATE" }, 400);

  const before = await c.env.DB.prepare(`SELECT * FROM students WHERE id = ?`).bind(id).first();
  values.push(id);
  await c.env.DB.prepare(`UPDATE students SET ${setClauses.join(", ")} WHERE id = ?`).bind(...values).run();

  await logAudit(c, "UPDATE_STUDENT", id, parsed.data, before);
  return c.json({ success: true });
});

// ---------- حذف ناعم (Soft Delete) ----------
students.delete("/:id", permissionMiddleware("students.crud"), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`UPDATE students SET deleted_at = datetime('now') WHERE id = ?`).bind(id).run();
  await logAudit(c, "DELETE_STUDENT", id, null);
  return c.json({ success: true });
});

// ---------- تسجيل الطالب في فصل لسنة دراسية ----------
const enrollSchema = z.object({ sectionId: z.string(), academicYearId: z.string() });

students.post("/:id/enroll", permissionMiddleware("students.crud"), async (c) => {
  const studentId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  try {
    await c.env.DB.prepare(
      `INSERT INTO student_classes (id, student_id, section_id, academic_year_id, enrolled_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
      .bind(id, studentId, parsed.data.sectionId, parsed.data.academicYearId)
      .run();
  } catch {
    return c.json({ error: "ALREADY_ENROLLED", message: "الطالب مسجَّل بالفعل في هذه السنة الدراسية" }, 409);
  }

  await c.env.DB.prepare(`UPDATE students SET status = 'enrolled' WHERE id = ?`).bind(studentId).run();
  await logAudit(c, "ENROLL_STUDENT", studentId, parsed.data);
  return c.json({ success: true }, 201);
});

async function logAudit(c: Context<AppBindings>, action: string, entityId: string | undefined, newValue: unknown, oldValue?: unknown) {
  const userId = c.get("userId");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
     VALUES (?, ?, ?, 'student', ?, ?, ?, datetime('now'))`
  )
    .bind(nanoid(), userId, action, entityId ?? null, oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(newValue))
    .run();
}

export default students;
