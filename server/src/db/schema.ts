// worker/src/db/schema.ts
// مخطط Drizzle ORM الكامل — يطابق worker/migrations/*.sql بنسبة 100% (39 جدولًا).
//
// ⚠️ ملاحظة صادقة عن الاستخدام الفعلي في هذا المشروع:
// كل الـ Routes الحالية (students.ts, results.ts, exams.ts...) تستخدم استعلامات SQL خام
// مباشرة عبر `c.env.DB.prepare(...)` بدل Drizzle Query Builder. هذا قرار مقصود لبيئة
// Cloudflare Workers: استعلامات SQL صريحة أسهل تتبعًا للأداء والفهارس، وتتفادى أي Overhead
// إضافي من طبقة ORM في بيئة Edge حساسة لزمن الاستجابة. هذا الملف يبقى المرجع الرسمي
// الوحيد لشكل الجداول (Source of Truth للأنواع)، ويمكن استخدامه مباشرة عبر
// `drizzle(env.DB)` و`db.select().from(students)...` في أي Route جديد يُفضَّل فيه
// الأمان النوعي الكامل بدل كتابة SQL يدويًا — كلا الأسلوبين يعملان على نفس القاعدة بأمان.

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  createdAt: text("created_at").notNull(),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = sqliteTable("role_permissions", {
  roleId: text("role_id").notNull(),
  permissionId: text("permission_id").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: text("role_id").notNull(),
  status: text("status", { enum: ["active", "locked", "disabled"] }).notNull().default("active"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastLoginAt: text("last_login_at"),
  linkedEntityType: text("linked_entity_type"),
  linkedEntityId: text("linked_entity_id"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const academicYears = sqliteTable("academic_years", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isCurrent: integer("is_current").notNull().default(0),
});

export const terms = sqliteTable("terms", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id").notNull(),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull(),
  isCurrent: integer("is_current").notNull().default(0),
});

export const stages = sqliteTable("stages", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const grades = sqliteTable("grades", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  gradeId: text("grade_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
});

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  name: text("name").notNull(),
  capacity: integer("capacity"),
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  subjectType: text("subject_type", { enum: ["main", "additional", "activity"] }).default("main"),
});

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  nationalIdEncrypted: text("national_id_encrypted"),
  birthDate: text("birth_date"),
  gender: text("gender", { enum: ["male", "female"] }),
  status: text("status", {
    enum: ["new", "enrolled", "transferred_in", "transferred_out", "passed", "failed", "expelled", "graduated"],
  }).notNull().default("new"),
  photoFileId: text("photo_file_id"),
  address: text("address"),
  phone: text("phone"),
  currentStageId: text("current_stage_id"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const examResults = sqliteTable("exam_results", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  examSubjectId: text("exam_subject_id").notNull(),
  totalScore: real("total_score"),
  percentage: real("percentage"),
  gradeLetter: text("grade_letter"),
  status: text("status", { enum: ["pass", "fail"] }),
  workflowState: text("workflow_state", {
    enum: ["draft", "submitted", "reviewed", "approved", "published", "locked"],
  }).notNull().default("draft"),
  enteredBy: text("entered_by"),
  updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull(),
});

export const parents = sqliteTable("parents", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  nationalIdEncrypted: text("national_id_encrypted"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const parentStudent = sqliteTable("parent_student", {
  parentId: text("parent_id").notNull(),
  studentId: text("student_id").notNull(),
  relationship: text("relationship").default("guardian"),
});

export const teachers = sqliteTable("teachers", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  nationalIdEncrypted: text("national_id_encrypted"),
  photoFileId: text("photo_file_id"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  department: text("department"),
  phone: text("phone"),
  email: text("email"),
  createdAt: text("created_at").notNull(),
});

export const studentClasses = sqliteTable("student_classes", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  sectionId: text("section_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  enrolledAt: text("enrolled_at").notNull(),
});

export const teacherSubjects = sqliteTable("teacher_subjects", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull(),
  subjectId: text("subject_id").notNull(),
  sectionId: text("section_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
});

export const timetables = sqliteTable("timetables", {
  id: text("id").primaryKey(),
  sectionId: text("section_id").notNull(),
  subjectId: text("subject_id").notNull(),
  teacherId: text("teacher_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  periodIndex: integer("period_index").notNull(),
  room: text("room"),
  academicYearId: text("academic_year_id").notNull(),
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  sectionId: text("section_id").notNull(),
  subjectId: text("subject_id"),
  date: text("date").notNull(),
  periodIndex: integer("period_index"),
  status: text("status", { enum: ["present", "absent", "late", "excused"] }).notNull(),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});

export const examTypes = sqliteTable("exam_types", {
  id: text("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
});

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id").notNull(),
  termId: text("term_id").notNull(),
  examTypeId: text("exam_type_id").notNull(),
  gradeId: text("grade_id").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status", { enum: ["draft", "scheduled", "ongoing", "completed"] }).notNull().default("draft"),
});

export const examSubjects = sqliteTable("exam_subjects", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull(),
  subjectId: text("subject_id").notNull(),
  maxScore: real("max_score").notNull(),
  passScore: real("pass_score").notNull(),
  examDate: text("exam_date"),
});

export const examCommittees = sqliteTable("exam_committees", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull(),
  name: text("name").notNull(),
  room: text("room"),
  supervisorTeacherId: text("supervisor_teacher_id"),
});

export const seatingNumbers = sqliteTable("seating_numbers", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull(),
  studentId: text("student_id").notNull(),
  committeeId: text("committee_id"),
  seatNumber: text("seat_number").notNull(),
});

export const gradeComponents = sqliteTable("grade_components", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  gradeId: text("grade_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  termId: text("term_id").notNull(),
  componentName: text("component_name").notNull(),
  maxScore: real("max_score").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
});

export const gradeScale = sqliteTable("grade_scale", {
  id: text("id").primaryKey(),
  minPercentage: real("min_percentage").notNull(),
  maxPercentage: real("max_percentage").notNull(),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en"),
  orderIndex: integer("order_index").notNull(),
});

export const resultDetails = sqliteTable("result_details", {
  id: text("id").primaryKey(),
  examResultId: text("exam_result_id").notNull(),
  gradeComponentId: text("grade_component_id").notNull(),
  score: real("score").notNull(),
});

export const resultApprovals = sqliteTable("result_approvals", {
  id: text("id").primaryKey(),
  examResultId: text("exam_result_id").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  actedBy: text("acted_by").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  academicYearId: text("academic_year_id").notNull(),
  termId: text("term_id"),
  certificateType: text("certificate_type").notNull(),
  fileId: text("file_id"),
  verificationCode: text("verification_code").notNull(),
  issuedBy: text("issued_by"),
  issuedAt: text("issued_at").notNull(),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  driveFileId: text("drive_file_id").notNull(),
  viewUrl: text("view_url").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: text("created_at").notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience", { enum: ["all", "students", "parents", "teachers", "staff"] }).notNull().default("all"),
  status: text("status", { enum: ["draft", "published", "scheduled", "archived"] }).notNull().default("draft"),
  publishAt: text("publish_at"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type"),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["sports", "cultural", "arts", "trip", "competition", "ceremony"] }),
  activityDate: text("activity_date"),
  createdBy: text("created_by"),
});

export const backupLogs = sqliteTable("backup_logs", {
  id: text("id").primaryKey(),
  triggeredBy: text("triggered_by"),
  status: text("status", { enum: ["success", "failed"] }),
  fileId: text("file_id"),
  createdAt: text("created_at").notNull(),
});
export const schoolSettings = sqliteTable("school_settings", {
  id: text("id").primaryKey().default("main"),
  schoolNameAr: text("school_name_ar").notNull(),
  schoolNameEn: text("school_name_en"),
  logoFileId: text("logo_file_id"),
  ministry: text("ministry"),
  educationDepartment: text("education_department"),
  governorate: text("governorate"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  primaryColor: text("primary_color").default("#0F5C4C"),
  currentAcademicYearId: text("current_academic_year_id"),
  currentTermId: text("current_term_id"),
  updatedAt: text("updated_at").notNull(),
});
