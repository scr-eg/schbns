-- ============================================================
-- Migration 0001: هيكل قاعدة البيانات الأساسي (Cloudflare D1 / SQLite)
-- ============================================================
PRAGMA foreign_keys = ON;

-- ---------- المستخدمون والصلاحيات ----------
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,           -- super_admin, school_admin, ...
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,           -- students.create, results.approve, ...
  description TEXT
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','disabled')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  linked_entity_type TEXT CHECK (linked_entity_type IN ('student','parent','teacher','staff', NULL)),
  linked_entity_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- الهيكل الأكاديمي ----------
CREATE TABLE academic_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- "2025/2026"
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0,1))
);

CREATE TABLE terms (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- "الترم الأول"
  order_index INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0,1))
);

CREATE TABLE stages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,           -- primary, preparatory, secondary
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,               -- "الصف الأول الابتدائي"
  name_en TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  grade_id TEXT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT
);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- "أ", "ب", "1", "2"
  capacity INTEGER
);

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  subject_type TEXT DEFAULT 'main' CHECK (subject_type IN ('main','additional','activity'))
);

-- ---------- الأشخاص ----------
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  national_id_encrypted TEXT,          -- مشفّر، لا يُخزَّن نصًا صريحًا
  birth_date TEXT,
  gender TEXT CHECK (gender IN ('male','female')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN
    ('new','enrolled','transferred_in','transferred_out','passed','failed','expelled','graduated')),
  photo_file_id TEXT,
  address TEXT,
  phone TEXT,
  current_stage_id TEXT REFERENCES stages(id),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE parents (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  national_id_encrypted TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE parent_student (
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'guardian',
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE teachers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  national_id_encrypted TEXT,
  photo_file_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE student_classes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, academic_year_id)
);

CREATE TABLE teacher_subjects (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE
);

-- ---------- الجداول والحضور ----------
CREATE TABLE timetables (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_index INTEGER NOT NULL,
  room TEXT,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  UNIQUE (section_id, day_of_week, period_index, academic_year_id),
  UNIQUE (teacher_id, day_of_week, period_index, academic_year_id)
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id),
  date TEXT NOT NULL,
  period_index INTEGER,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, date, period_index)
);

-- ---------- الامتحانات والكنترول ----------
CREATE TABLE exam_types (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT
);

CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  exam_type_id TEXT NOT NULL REFERENCES exam_types(id),
  grade_id TEXT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','ongoing','completed'))
);

CREATE TABLE grade_components (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_id TEXT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,        -- "أعمال السنة", "الامتحان", "الأنشطة"
  max_score REAL NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE exam_subjects (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  max_score REAL NOT NULL,
  pass_score REAL NOT NULL,
  exam_date TEXT,
  UNIQUE (exam_id, subject_id)
);

CREATE TABLE exam_committees (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room TEXT,
  supervisor_teacher_id TEXT REFERENCES teachers(id)
);

CREATE TABLE seating_numbers (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  committee_id TEXT REFERENCES exam_committees(id),
  seat_number TEXT NOT NULL,
  UNIQUE (exam_id, seat_number),
  UNIQUE (exam_id, student_id)
);

CREATE TABLE exam_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_subject_id TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  total_score REAL,
  percentage REAL,
  grade_letter TEXT,
  status TEXT CHECK (status IN ('pass','fail', NULL)),
  workflow_state TEXT NOT NULL DEFAULT 'draft' CHECK (workflow_state IN
    ('draft','submitted','reviewed','approved','published','locked')),
  entered_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, exam_subject_id)
);

CREATE TABLE result_details (
  id TEXT PRIMARY KEY,
  exam_result_id TEXT NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
  grade_component_id TEXT NOT NULL REFERENCES grade_components(id),
  score REAL NOT NULL,
  UNIQUE (exam_result_id, grade_component_id)
);

CREATE TABLE result_approvals (
  id TEXT PRIMARY KEY,
  exam_result_id TEXT NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  acted_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  term_id TEXT REFERENCES terms(id),
  certificate_type TEXT NOT NULL,      -- result_certificate, transcript, success_certificate
  file_id TEXT,
  verification_code TEXT NOT NULL UNIQUE,
  issued_by TEXT REFERENCES users(id),
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- الملفات (بديل R2 عبر GAS) ----------
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,           -- student_photo, certificate, announcement, logo, import
  entity_id TEXT,
  drive_file_id TEXT NOT NULL,
  view_url TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- المحتوى العام ----------
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','students','parents','teachers','staff')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  publish_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('sports','cultural','arts','trip','competition','ceremony')),
  activity_date TEXT,
  created_by TEXT REFERENCES users(id)
);

-- ---------- الإعدادات والتدقيق ----------
CREATE TABLE school_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  school_name_ar TEXT NOT NULL DEFAULT 'مدرسة تجريبية',
  school_name_en TEXT,
  logo_file_id TEXT,
  ministry TEXT DEFAULT 'وزارة التربية والتعليم',
  education_department TEXT,
  governorate TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  primary_color TEXT DEFAULT '#0F5C4C',
  current_academic_year_id TEXT REFERENCES academic_years(id),
  current_term_id TEXT REFERENCES terms(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,                -- UPDATE_RESULT, DELETE_STUDENT, LOGIN_FAILED, ...
  entity_type TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE backup_logs (
  id TEXT PRIMARY KEY,
  triggered_by TEXT,                   -- 'cron' | user_id
  status TEXT CHECK (status IN ('success','failed')),
  file_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- الفهارس الأساسية ----------
CREATE INDEX idx_students_code ON students(student_code);
CREATE INDEX idx_students_stage ON students(current_stage_id);
CREATE INDEX idx_student_classes_year ON student_classes(academic_year_id);
CREATE INDEX idx_exam_results_student ON exam_results(student_id);
CREATE INDEX idx_exam_results_state ON exam_results(workflow_state);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_certificates_code ON certificates(verification_code);
