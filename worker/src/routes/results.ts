// worker/src/routes/results.ts
// قلب نظام الكنترول: إدخال الدرجات + سير عمل الاعتماد الإلزامي
// Draft → Submitted → Reviewed → Approved → Published → Locked
import { Hono, Context } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const results = new Hono<AppBindings>();
results.use("*", authMiddleware);

// ============================================================
// دوال مساعدة
// ============================================================

/** يعيد حساب مجموع الدرجات والنسبة والتقدير وحالة النجاح/الرسوب لنتيجة واحدة */
async function recomputeResult(c: Context<AppBindings>, examResultId: string) {
  const detailsResult = await c.env.DB.prepare(
    `SELECT SUM(score) as total FROM result_details WHERE exam_result_id = ?`
  ).bind(examResultId).first<{ total: number | null }>();

  const result = await c.env.DB.prepare(
    `SELECT er.exam_subject_id, es.max_score, es.pass_score
     FROM exam_results er JOIN exam_subjects es ON es.id = er.exam_subject_id
     WHERE er.id = ?`
  ).bind(examResultId).first<{ exam_subject_id: string; max_score: number; pass_score: number }>();

  if (!result) return;

  const total = detailsResult?.total ?? 0;
  const percentage = result.max_score > 0 ? (total / result.max_score) * 100 : 0;
  const status = total >= result.pass_score ? "pass" : "fail";

  const scale = await c.env.DB.prepare(
    `SELECT label_ar FROM grade_scale WHERE ? >= min_percentage AND ? < max_percentage LIMIT 1`
  ).bind(percentage, percentage).first<{ label_ar: string }>();

  await c.env.DB.prepare(
    `UPDATE exam_results SET total_score = ?, percentage = ?, status = ?, grade_letter = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(total, percentage, status, scale?.label_ar ?? null, examResultId)
    .run();
}

interface ValidationIssue { studentId: string; studentName: string; message: string; }

/** التحقق الشامل قبل السماح بالاعتماد (Approve) — يطابق docs/EXAM_WORKFLOW.md قسم 3 */
async function validateExamSubjectReadiness(c: Context<AppBindings>, examSubjectId: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const examSubject = await c.env.DB.prepare(
    `SELECT es.exam_id, es.max_score, e.grade_id, e.academic_year_id
     FROM exam_subjects es JOIN exams e ON e.id = es.exam_id WHERE es.id = ?`
  ).bind(examSubjectId).first<{ exam_id: string; max_score: number; grade_id: string; academic_year_id: string }>();

  if (!examSubject) {
    issues.push({ studentId: "-", studentName: "-", message: "مادة الامتحان غير موجودة" });
    return issues;
  }

  // كل الطلاب المفترض أن يكون لهم درجة (مسجَّلون في صف الامتحان لهذه السنة الدراسية)
  const enrolledResult = await c.env.DB.prepare(
    `SELECT DISTINCT s.id, s.full_name FROM students s
     JOIN student_classes sc ON sc.student_id = s.id
     JOIN sections sec ON sec.id = sc.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE cl.grade_id = ? AND sc.academic_year_id = ? AND s.deleted_at IS NULL`
  ).bind(examSubject.grade_id, examSubject.academic_year_id).all<{ id: string; full_name: string }>();

  const resultsResult = await c.env.DB.prepare(
    `SELECT student_id, total_score FROM exam_results WHERE exam_subject_id = ?`
  ).bind(examSubjectId).all<{ student_id: string; total_score: number | null }>();
  const resultsByStudent = new Map(resultsResult.results.map((r) => [r.student_id, r.total_score]));

  const seatingResult = await c.env.DB.prepare(
    `SELECT student_id FROM seating_numbers WHERE exam_id = ?`
  ).bind(examSubject.exam_id).all<{ student_id: string }>();
  const studentsWithSeat = new Set(seatingResult.results.map((r) => r.student_id));

  for (const student of enrolledResult.results) {
    if (!resultsByStudent.has(student.id)) {
      issues.push({ studentId: student.id, studentName: student.full_name, message: "لا توجد درجة مُدخلة لهذا الطالب في هذه المادة" });
      continue;
    }
    const total = resultsByStudent.get(student.id);
    if (total === null || total === undefined) {
      issues.push({ studentId: student.id, studentName: student.full_name, message: "الدرجة غير مكتملة (لم يتم رصد كل المكوّنات)" });
    } else if (total > examSubject.max_score) {
      issues.push({ studentId: student.id, studentName: student.full_name, message: `الدرجة (${total}) تتجاوز الدرجة النهائية (${examSubject.max_score})` });
    }
    if (!studentsWithSeat.has(student.id)) {
      issues.push({ studentId: student.id, studentName: student.full_name, message: "لا يوجد رقم جلوس لهذا الطالب في هذا الامتحان" });
    }
  }

  return issues;
}

/** يتحقق أن المعلم الحالي مُكلَّف فعليًا بتدريس هذه المادة لهذا الطالب (منع التلاعب بمواد الآخرين) */
async function teacherOwnsExamSubject(c: Context<AppBindings>, examSubjectId: string, studentId: string): Promise<boolean> {
  const roleCode = c.get("roleCode");
  if (roleCode !== "teacher") return true; // غير المعلم يخضع لصلاحيات أخرى (results.review/approve)

  const teacherId = c.get("linkedEntityId");
  if (!teacherId) return false;

  const row = await c.env.DB.prepare(
    `SELECT 1 FROM exam_subjects es
     JOIN exams e ON e.id = es.exam_id
     JOIN teacher_subjects ts ON ts.subject_id = es.subject_id AND ts.academic_year_id = e.academic_year_id
     JOIN student_classes sc ON sc.section_id = ts.section_id AND sc.academic_year_id = ts.academic_year_id
     WHERE es.id = ? AND ts.teacher_id = ? AND sc.student_id = ?
     LIMIT 1`
  ).bind(examSubjectId, teacherId, studentId).first();

  return !!row;
}

// ============================================================
// إدخال الدرجات (Draft)
// ============================================================
const entrySchema = z.object({
  examSubjectId: z.string(),
  studentId: z.string(),
  components: z.array(z.object({ gradeComponentId: z.string(), score: z.number().min(0) })).min(1),
});

results.post("/entry", permissionMiddleware(["results.enter", "results.approve"]), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  const { examSubjectId, studentId, components } = parsed.data;

  // ⚠️ تحقق فعلي: المعلم لا يستطيع إدخال درجة لمادة/طالب ليس مُكلَّفًا بتدريسه
  if (!(await teacherOwnsExamSubject(c, examSubjectId, studentId))) {
    return c.json({ error: "FORBIDDEN", message: "لست مُكلَّفًا بتدريس هذه المادة لهذا الطالب" }, 403);
  }

  // التحقق من عدم تجاوز أي مكوّن حده الأقصى المُعرَّف
  const componentIds = components.map((cmp) => cmp.gradeComponentId);
  const placeholders = componentIds.map(() => "?").join(",");
  const componentDefs = await c.env.DB.prepare(
    `SELECT id, max_score FROM grade_components WHERE id IN (${placeholders})`
  ).bind(...componentIds).all<{ id: string; max_score: number }>();
  const maxById = new Map(componentDefs.results.map((d) => [d.id, d.max_score]));

  for (const cmp of components) {
    const max = maxById.get(cmp.gradeComponentId);
    if (max === undefined) return c.json({ error: "INVALID_COMPONENT", message: "مكوّن درجة غير معروف" }, 400);
    if (cmp.score > max) {
      return c.json({
        error: "SCORE_EXCEEDS_MAX",
        message: `الدرجة (${cmp.score}) تتجاوز الحد الأقصى المسموح (${max}) لهذا المكوّن`,
      }, 400);
    }
  }

  // الحصول على exam_result الحالية أو إنشاؤها (منع التعديل إن كانت الحالة تجاوزت Draft)
  let examResult = await c.env.DB.prepare(
    `SELECT id, workflow_state FROM exam_results WHERE student_id = ? AND exam_subject_id = ?`
  ).bind(studentId, examSubjectId).first<{ id: string; workflow_state: string }>();

  if (examResult && examResult.workflow_state !== "draft") {
    return c.json({
      error: "RESULT_LOCKED_FOR_EDIT",
      message: `لا يمكن تعديل الدرجة، الحالة الحالية: ${examResult.workflow_state}. استخدم مسار التعديل الاستثنائي إن لزم.`,
    }, 409);
  }

  let examResultId: string;
  if (examResult) {
    examResultId = examResult.id;
    await c.env.DB.prepare(`UPDATE exam_results SET entered_by = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(c.get("userId"), examResultId)
      .run();
  } else {
    examResultId = nanoid();
    await c.env.DB.prepare(
      `INSERT INTO exam_results (id, student_id, exam_subject_id, workflow_state, entered_by, updated_at)
       VALUES (?, ?, ?, 'draft', ?, datetime('now'))`
    )
      .bind(examResultId, studentId, examSubjectId, c.get("userId"))
      .run();
  }

  // Upsert كل مكوّنات الدرجة دفعة واحدة
  const statements = components.map((cmp) =>
    c.env.DB.prepare(
      `INSERT INTO result_details (id, exam_result_id, grade_component_id, score) VALUES (?, ?, ?, ?)
       ON CONFLICT(exam_result_id, grade_component_id) DO UPDATE SET score = excluded.score`
    ).bind(nanoid(), examResultId, cmp.gradeComponentId, cmp.score)
  );
  await c.env.DB.batch(statements);

  await recomputeResult(c, examResultId);

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
     VALUES (?, ?, 'ENTER_RESULT', 'exam_result', ?, ?, datetime('now'))`
  )
    .bind(nanoid(), c.get("userId"), examResultId, JSON.stringify(components))
    .run();

  return c.json({ examResultId, success: true });
});

// ---------- كشف إدخال الدرجات الكامل (مكوّنات + طلاب + درجاتهم الحالية) ----------
results.get("/exam-subject/:examSubjectId/entry-sheet", permissionMiddleware(["results.enter", "results.review", "results.approve"]), async (c) => {
  const examSubjectId = c.req.param("examSubjectId");

  const examSubject = await c.env.DB.prepare(
    `SELECT es.subject_id, es.max_score, e.grade_id, e.academic_year_id, e.term_id
     FROM exam_subjects es JOIN exams e ON e.id = es.exam_id WHERE es.id = ?`
  ).bind(examSubjectId).first<{ subject_id: string; max_score: number; grade_id: string; academic_year_id: string; term_id: string }>();

  if (!examSubject) return c.json({ error: "NOT_FOUND" }, 404);

  const componentsResult = await c.env.DB.prepare(
    `SELECT id, component_name, max_score, order_index FROM grade_components
     WHERE subject_id = ? AND grade_id = ? AND academic_year_id = ? AND term_id = ? ORDER BY order_index`
  ).bind(examSubject.subject_id, examSubject.grade_id, examSubject.academic_year_id, examSubject.term_id).all();

  const studentsResult = await c.env.DB.prepare(
    `SELECT DISTINCT s.id as student_id, s.student_code, s.full_name
     FROM students s
     JOIN student_classes sc ON sc.student_id = s.id
     JOIN sections sec ON sec.id = sc.section_id
     JOIN classes cl ON cl.id = sec.class_id
     WHERE cl.grade_id = ? AND sc.academic_year_id = ? AND s.deleted_at IS NULL
     ORDER BY s.full_name`
  ).bind(examSubject.grade_id, examSubject.academic_year_id).all<{ student_id: string; student_code: string; full_name: string }>();

  const detailsResult = await c.env.DB.prepare(
    `SELECT er.student_id, er.workflow_state, rd.grade_component_id, rd.score
     FROM exam_results er LEFT JOIN result_details rd ON rd.exam_result_id = er.id
     WHERE er.exam_subject_id = ?`
  ).bind(examSubjectId).all<{ student_id: string; workflow_state: string; grade_component_id: string | null; score: number | null }>();

  const stateByStudent = new Map<string, string>();
  const scoresByStudent = new Map<string, Record<string, number>>();
  for (const row of detailsResult.results) {
    stateByStudent.set(row.student_id, row.workflow_state);
    if (row.grade_component_id) {
      const existing = scoresByStudent.get(row.student_id) ?? {};
      existing[row.grade_component_id] = row.score ?? 0;
      scoresByStudent.set(row.student_id, existing);
    }
  }

  const students = studentsResult.results.map((s) => ({
    ...s,
    workflowState: stateByStudent.get(s.student_id) ?? null,
    scores: scoresByStudent.get(s.student_id) ?? {},
  }));

  return c.json({ components: componentsResult.results, students });
});

// ---------- عرض نتائج مادة امتحان معيّنة (لواجهة إدخال المعلم أو مراجعة الكنترول) ----------
results.get("/exam-subject/:examSubjectId", permissionMiddleware(["results.enter", "results.review", "results.approve"]), async (c) => {
  const examSubjectId = c.req.param("examSubjectId");
  const { results: rows } = await c.env.DB.prepare(
    `SELECT er.id, er.student_id, s.student_code, s.full_name, er.total_score, er.percentage,
            er.grade_letter, er.status, er.workflow_state
     FROM exam_results er JOIN students s ON s.id = er.student_id
     WHERE er.exam_subject_id = ? ORDER BY s.full_name`
  ).bind(examSubjectId).all();

  return c.json({ data: rows });
});

// ============================================================
// انتقالات سير العمل
// ============================================================

async function transition(
  c: Context<AppBindings>,
  examSubjectId: string | undefined,
  fromState: string,
  toState: string,
  runValidation: boolean
) {
  if (!examSubjectId) return c.json({ error: "MISSING_EXAM_SUBJECT_ID" }, 400);

  if (runValidation) {
    const issues = await validateExamSubjectReadiness(c, examSubjectId);
    if (issues.length > 0) {
      return c.json({ error: "VALIDATION_FAILED", message: "توجد مشكلات يجب حلّها قبل الاعتماد", issues }, 400);
    }
  }

  const pending = await c.env.DB.prepare(
    `SELECT id FROM exam_results WHERE exam_subject_id = ? AND workflow_state = ?`
  ).bind(examSubjectId, fromState).all<{ id: string }>();

  if (pending.results.length === 0) {
    return c.json({ error: "NOTHING_TO_TRANSITION", message: `لا توجد نتائج بحالة "${fromState}" لهذه المادة` }, 400);
  }

  const userId = c.get("userId");
  const statements = pending.results.flatMap((r) => [
    c.env.DB.prepare(`UPDATE exam_results SET workflow_state = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(toState, r.id),
    c.env.DB.prepare(
      `INSERT INTO result_approvals (id, exam_result_id, from_state, to_state, acted_by, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(nanoid(), r.id, fromState, toState, userId),
  ]);

  await c.env.DB.batch(statements);

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, new_value, created_at)
     VALUES (?, ?, ?, 'exam_subject', ?, datetime('now'))`
  )
    .bind(nanoid(), userId, `RESULTS_${fromState.toUpperCase()}_TO_${toState.toUpperCase()}`, JSON.stringify({ examSubjectId, count: pending.results.length }))
    .run();

  return c.json({ success: true, transitionedCount: pending.results.length });
}

results.post("/exam-subject/:id/submit", permissionMiddleware("results.enter"), async (c) => {
  const examSubjectId = c.req.param("id");
  if (!examSubjectId) return c.json({ error: "MISSING_EXAM_SUBJECT_ID" }, 400);

  // ⚠️ تحقق فعلي: معلم لا يستطيع إرسال نتائج مادة ليس مُكلَّفًا بتدريسها
  const roleCode = c.get("roleCode");
  if (roleCode === "teacher") {
    const teacherId = c.get("linkedEntityId");
    const owns = await c.env.DB.prepare(
      `SELECT 1 FROM exam_subjects es JOIN exams e ON e.id = es.exam_id
       JOIN teacher_subjects ts ON ts.subject_id = es.subject_id AND ts.academic_year_id = e.academic_year_id
       WHERE es.id = ? AND ts.teacher_id = ? LIMIT 1`
    ).bind(examSubjectId, teacherId).first();
    if (!owns) return c.json({ error: "FORBIDDEN", message: "لست مُكلَّفًا بتدريس هذه المادة" }, 403);
  }

  return transition(c, examSubjectId, "draft", "submitted", false);
});

results.post("/exam-subject/:id/review", permissionMiddleware("results.review"), async (c) =>
  transition(c, c.req.param("id"), "submitted", "reviewed", false)
);

// ⚠️ بوابة التحقق الحقيقية: لا اعتماد قبل حل كل المشكلات (درجات ناقصة/متجاوزة/بلا رقم جلوس)
results.post("/exam-subject/:id/approve", permissionMiddleware("results.approve"), async (c) =>
  transition(c, c.req.param("id"), "reviewed", "approved", true)
);

results.post("/exam-subject/:id/publish", permissionMiddleware("results.approve"), async (c) => {
  const examSubjectId = c.req.param("id");
  if (!examSubjectId) return c.json({ error: "MISSING_EXAM_SUBJECT_ID" }, 400);

  const response = await transition(c, examSubjectId, "approved", "published", false);

  // ⚠️ إشعار فعلي وليس شكليًا: يُنشأ فقط بعد نجاح النشر الفعلي في قاعدة البيانات
  if (response.status === 200) {
    await notifyPublishedResults(c, examSubjectId);
  }
  return response;
});

/** ينشئ إشعار "نتيجة جديدة" لكل طالب نُشرت نتيجته ولكل ولي أمر مرتبط به */
async function notifyPublishedResults(c: Context<AppBindings>, examSubjectId: string) {
  const rows = await c.env.DB.prepare(
    `SELECT er.student_id, s.full_name, sub.name_ar as subject_name
     FROM exam_results er
     JOIN students s ON s.id = er.student_id
     JOIN exam_subjects es ON es.id = er.exam_subject_id
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE er.exam_subject_id = ? AND er.workflow_state = 'published'`
  ).bind(examSubjectId).all<{ student_id: string; full_name: string; subject_name: string }>();

  if (rows.results.length === 0) return;

  const studentIds = rows.results.map((r) => r.student_id);
  const placeholders = studentIds.map(() => "?").join(",");

  // جلب حسابات المستخدمين المرتبطة (الطالب نفسه + كل أولياء أموره)
  const studentUsers = await c.env.DB.prepare(
    `SELECT id, linked_entity_id FROM users WHERE linked_entity_type = 'student' AND linked_entity_id IN (${placeholders})`
  ).bind(...studentIds).all<{ id: string; linked_entity_id: string }>();

  const parentLinks = await c.env.DB.prepare(
    `SELECT ps.student_id, u.id as user_id FROM parent_student ps
     JOIN users u ON u.linked_entity_type = 'parent' AND u.linked_entity_id = ps.parent_id
     WHERE ps.student_id IN (${placeholders})`
  ).bind(...studentIds).all<{ student_id: string; user_id: string }>();

  const statements = [];
  for (const row of rows.results) {
    const studentUser = studentUsers.results.find((u) => u.linked_entity_id === row.student_id);
    if (studentUser) {
      statements.push(c.env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, 'result_published', datetime('now'))`
      ).bind(nanoid(), studentUser.id, "نتيجة جديدة", `تم نشر نتيجتك في مادة ${row.subject_name}`));
    }
    for (const parentLink of parentLinks.results.filter((p) => p.student_id === row.student_id)) {
      statements.push(c.env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, created_at) VALUES (?, ?, ?, ?, 'result_published', datetime('now'))`
      ).bind(nanoid(), parentLink.user_id, "نتيجة جديدة", `تم نشر نتيجة ${row.full_name} في مادة ${row.subject_name}`));
    }
  }

  if (statements.length > 0) await c.env.DB.batch(statements);
}

results.post("/exam-subject/:id/lock", permissionMiddleware("results.approve"), async (c) =>
  transition(c, c.req.param("id"), "published", "locked", false)
);

// ============================================================
// التعديل الاستثنائي بعد القفل — super_admin فقط، موثّق بالكامل
// ============================================================
const overrideSchema = z.object({
  components: z.array(z.object({ gradeComponentId: z.string(), score: z.number().min(0) })).min(1),
  reason: z.string().min(5, "سبب التعديل إلزامي ويجب أن يكون واضحًا"),
});

results.patch("/:id/override", permissionMiddleware("results.override"), async (c) => {
  const examResultId = c.req.param("id");
  if (!examResultId) return c.json({ error: "MISSING_ID" }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);

  const before = await c.env.DB.prepare(`SELECT * FROM exam_results WHERE id = ?`).bind(examResultId).first();
  if (!before) return c.json({ error: "NOT_FOUND" }, 404);

  const beforeDetails = await c.env.DB.prepare(`SELECT * FROM result_details WHERE exam_result_id = ?`)
    .bind(examResultId).all();

  const statements = parsed.data.components.map((cmp) =>
    c.env.DB.prepare(
      `INSERT INTO result_details (id, exam_result_id, grade_component_id, score) VALUES (?, ?, ?, ?)
       ON CONFLICT(exam_result_id, grade_component_id) DO UPDATE SET score = excluded.score`
    ).bind(nanoid(), examResultId, cmp.gradeComponentId, cmp.score)
  );
  await c.env.DB.batch(statements);
  await recomputeResult(c, examResultId);

  const userId = c.get("userId");
  // تسجيل موثّق بالكامل: من، متى، القيمة القديمة، الجديدة، السبب — لا يمكن حذفه لاحقًا
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, reason, created_at)
     VALUES (?, ?, 'OVERRIDE_LOCKED_RESULT', 'exam_result', ?, ?, ?, ?, datetime('now'))`
  )
    .bind(nanoid(), userId, examResultId, JSON.stringify(beforeDetails.results), JSON.stringify(parsed.data.components), parsed.data.reason)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO result_approvals (id, exam_result_id, from_state, to_state, acted_by, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(nanoid(), examResultId, (before as { workflow_state: string }).workflow_state, (before as { workflow_state: string }).workflow_state, userId, parsed.data.reason)
    .run();

  return c.json({ success: true, message: "تم التعديل الاستثنائي وتوثيقه بالكامل" });
});

// ============================================================
// عرض نتائج طالب (محمي: طالب/ولي أمر يريان المنشور/المُقفل فقط لأنفسهم)
// ============================================================
results.get("/student/:studentId", permissionMiddleware(["results.read_own", "results.approve", "results.review", "reports.read", "reports.read_limited"]), async (c) => {
  const studentId = c.req.param("studentId");
  const roleCode = c.get("roleCode");
  const linkedEntityId = c.get("linkedEntityId");

  const isOwnDataRole = roleCode === "student" || roleCode === "parent";
  if (isOwnDataRole) {
    if (roleCode === "student" && linkedEntityId !== studentId) return c.json({ error: "FORBIDDEN" }, 403);
    if (roleCode === "parent") {
      const link = await c.env.DB.prepare(`SELECT 1 FROM parent_student WHERE parent_id = ? AND student_id = ?`)
        .bind(linkedEntityId, studentId).first();
      if (!link) return c.json({ error: "FORBIDDEN" }, 403);
    }
  }

  const stateFilter = isOwnDataRole ? `AND er.workflow_state IN ('published', 'locked')` : "";

  const { results: rows } = await c.env.DB.prepare(
    `SELECT er.id, sub.name_ar as subject_name, er.total_score, er.percentage, er.grade_letter,
            er.status, er.workflow_state, e.name as exam_name, t.name as term_name
     FROM exam_results er
     JOIN exam_subjects es ON es.id = er.exam_subject_id
     JOIN subjects sub ON sub.id = es.subject_id
     JOIN exams e ON e.id = es.exam_id
     JOIN terms t ON t.id = e.term_id
     WHERE er.student_id = ? ${stateFilter}
     ORDER BY e.start_date DESC`
  )
    .bind(studentId)
    .all();

  return c.json({ data: rows });
});

export default results;
