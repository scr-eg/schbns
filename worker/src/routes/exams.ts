// worker/src/routes/exams.ts
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const exams = new Hono<AppBindings>();
exams.use("*", authMiddleware);

// ---------- أنواع الامتحانات ----------
exams.get("/types", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM exam_types`).all();
  return c.json({ data: results });
});

const examTypeSchema = z.object({ nameAr: z.string().min(1), nameEn: z.string().optional() });
exams.post("/types", permissionMiddleware("exams.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = examTypeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);
  const id = nanoid();
  await c.env.DB.prepare(`INSERT INTO exam_types (id, name_ar, name_en) VALUES (?, ?, ?)`)
    .bind(id, parsed.data.nameAr, parsed.data.nameEn ?? null)
    .run();
  return c.json({ id }, 201);
});

// ---------- الامتحانات ----------
exams.get("/", permissionMiddleware(["exams.read", "exams.manage"]), async (c) => {
  const academicYearId = c.req.query("academicYearId");
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (academicYearId) { conditions.push("e.academic_year_id = ?"); values.push(academicYearId); }

  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.name, e.status, e.start_date, e.end_date,
            et.name_ar as exam_type_name, g.name_ar as grade_name, t.name as term_name
     FROM exams e
     JOIN exam_types et ON et.id = e.exam_type_id
     JOIN grades g ON g.id = e.grade_id
     JOIN terms t ON t.id = e.term_id
     ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
     ORDER BY e.start_date DESC`
  )
    .bind(...values)
    .all();

  return c.json({ data: results });
});

exams.get("/:id", permissionMiddleware(["exams.read", "exams.manage"]), async (c) => {
  const id = c.req.param("id");
  const exam = await c.env.DB.prepare(`SELECT * FROM exams WHERE id = ?`).bind(id).first();
  if (!exam) return c.json({ error: "NOT_FOUND" }, 404);

  const subjects = await c.env.DB.prepare(
    `SELECT es.id, es.max_score, es.pass_score, es.exam_date, sub.id as subject_id, sub.name_ar as subject_name
     FROM exam_subjects es JOIN subjects sub ON sub.id = es.subject_id WHERE es.exam_id = ?`
  ).bind(id).all();

  const committees = await c.env.DB.prepare(
    `SELECT ec.id, ec.name, ec.room, te.full_name as supervisor_name
     FROM exam_committees ec LEFT JOIN teachers te ON te.id = ec.supervisor_teacher_id WHERE ec.exam_id = ?`
  ).bind(id).all();

  return c.json({ data: exam, subjects: subjects.results, committees: committees.results });
});

const createExamSchema = z.object({
  academicYearId: z.string(),
  termId: z.string(),
  examTypeId: z.string(),
  gradeId: z.string(),
  name: z.string().min(2),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

exams.post("/", permissionMiddleware("exams.manage"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createExamSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const id = nanoid();
  const d = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO exams (id, academic_year_id, term_id, exam_type_id, grade_id, name, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
  )
    .bind(id, d.academicYearId, d.termId, d.examTypeId, d.gradeId, d.name, d.startDate ?? null, d.endDate ?? null)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'CREATE_EXAM', 'exam', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), id, JSON.stringify(d))
    .run();

  return c.json({ id }, 201);
});

const updateStatusSchema = z.object({ status: z.enum(["draft", "scheduled", "ongoing", "completed"]) });
exams.patch("/:id/status", permissionMiddleware("exams.manage"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);
  await c.env.DB.prepare(`UPDATE exams SET status = ? WHERE id = ?`).bind(parsed.data.status, id).run();
  return c.json({ success: true });
});

// ---------- ربط مادة بالامتحان ----------
const examSubjectSchema = z.object({
  subjectId: z.string(),
  maxScore: z.number().positive(),
  passScore: z.number().nonnegative(),
  examDate: z.string().optional(),
});

exams.post("/:id/subjects", permissionMiddleware("exams.manage"), async (c) => {
  const examId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = examSubjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  if (parsed.data.passScore > parsed.data.maxScore) {
    return c.json({ error: "INVALID_PASS_SCORE", message: "درجة النجاح لا يمكن أن تتجاوز الدرجة النهائية" }, 400);
  }

  const id = nanoid();
  try {
    await c.env.DB.prepare(
      `INSERT INTO exam_subjects (id, exam_id, subject_id, max_score, pass_score, exam_date)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, examId, parsed.data.subjectId, parsed.data.maxScore, parsed.data.passScore, parsed.data.examDate ?? null)
      .run();
  } catch {
    return c.json({ error: "SUBJECT_ALREADY_LINKED", message: "هذه المادة مرتبطة بالفعل بهذا الامتحان" }, 409);
  }

  return c.json({ id }, 201);
});

// ---------- اللجان ----------
const committeeSchema = z.object({ name: z.string().min(1), room: z.string().optional(), supervisorTeacherId: z.string().optional() });
exams.post("/:id/committees", permissionMiddleware("exams.manage"), async (c) => {
  const examId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = committeeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR" }, 400);

  const id = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO exam_committees (id, exam_id, name, room, supervisor_teacher_id) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, examId, parsed.data.name, parsed.data.room ?? null, parsed.data.supervisorTeacherId ?? null)
    .run();

  return c.json({ id }, 201);
});

// ---------- توليد أرقام الجلوس تلقائيًا لكل الطلاب المسجَّلين في صفوف هذا الامتحان ----------
exams.post("/:id/seating/generate", permissionMiddleware("exams.manage"), async (c) => {
  const examId = c.req.param("id");
  const exam = await c.env.DB.prepare(`SELECT grade_id, academic_year_id FROM exams WHERE id = ?`)
    .bind(examId)
    .first<{ grade_id: string; academic_year_id: string }>();
  if (!exam) return c.json({ error: "NOT_FOUND" }, 404);

  const studentsResult = await c.env.DB.prepare(
    `SELECT DISTINCT s.id FROM students s
     JOIN student_classes sc ON sc.student_id = s.id
     JOIN sections sec ON sec.id = sc.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE cl.grade_id = ? AND sc.academic_year_id = ? AND s.deleted_at IS NULL
     ORDER BY s.full_name`
  )
    .bind(exam.grade_id, exam.academic_year_id)
    .all<{ id: string }>();

  const existingResult = await c.env.DB.prepare(`SELECT student_id FROM seating_numbers WHERE exam_id = ?`)
    .bind(examId)
    .all<{ student_id: string }>();
  const existingStudentIds = new Set(existingResult.results.map((r) => r.student_id));

  const toCreate = studentsResult.results.filter((s) => !existingStudentIds.has(s.id));
  if (toCreate.length === 0) {
    return c.json({ success: true, createdCount: 0, message: "كل الطلاب لديهم أرقام جلوس بالفعل" });
  }

  const lastSeatResult = await c.env.DB.prepare(
    `SELECT seat_number FROM seating_numbers WHERE exam_id = ? ORDER BY CAST(seat_number AS INTEGER) DESC LIMIT 1`
  )
    .bind(examId)
    .first<{ seat_number: string }>();
  let nextSeat = lastSeatResult ? parseInt(lastSeatResult.seat_number, 10) + 1 : 1001;

  const statements = toCreate.map((s) => {
    const stmt = c.env.DB.prepare(
      `INSERT INTO seating_numbers (id, exam_id, student_id, seat_number) VALUES (?, ?, ?, ?)`
    ).bind(nanoid(), examId, s.id, String(nextSeat));
    nextSeat++;
    return stmt;
  });

  await c.env.DB.batch(statements);
  return c.json({ success: true, createdCount: toCreate.length });
});

exams.get("/:id/seating", permissionMiddleware(["exams.read", "exams.manage"]), async (c) => {
  const examId = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    `SELECT sn.seat_number, s.student_code, s.full_name, ec.name as committee_name
     FROM seating_numbers sn JOIN students s ON s.id = sn.student_id
     LEFT JOIN exam_committees ec ON ec.id = sn.committee_id
     WHERE sn.exam_id = ? ORDER BY CAST(sn.seat_number AS INTEGER)`
  )
    .bind(examId)
    .all();
  return c.json({ data: results });
});

exams.get("/mine/subjects", async (c) => {
  const roleCode = c.get("roleCode");
  const teacherId = c.get("linkedEntityId");
  if (roleCode !== "teacher" || !teacherId) {
    return c.json({ error: "FORBIDDEN", message: "متاح فقط لحساب معلم مرتبط بسجل معلم" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT es.id as exam_subject_id, e.name as exam_name, e.status as exam_status,
            sub.name_ar as subject_name, g.name_ar as grade_name
     FROM exam_subjects es
     JOIN exams e ON e.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     JOIN grades g ON g.id = e.grade_id
     JOIN teacher_subjects ts ON ts.subject_id = es.subject_id AND ts.academic_year_id = e.academic_year_id
     WHERE ts.teacher_id = ?
     ORDER BY e.start_date DESC`
  )
    .bind(teacherId)
    .all();

  return c.json({ data: results });
});

export default exams;
