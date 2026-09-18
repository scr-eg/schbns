-- ============================================================
-- Migration 0010: إزالة كل البيانات الوهمية (DEMO DATA) نهائيًا
-- ============================================================
-- تُبقي فقط: البيانات الهيكلية الحقيقية (أدوار، صلاحيات، مراحل، صفوف،
-- جدول تقديرات) التي تحتاجها أي مدرسة وليست بيانات شخصية لأحد،
-- وحساب إداري واحد فقط (super_admin) بكلمة مرور مؤقتة عشوائية.
--
-- ⚠️ بعد التطبيق، سجّل الدخول فورًا بالحساب في docs/INITIAL_ADMIN.md
-- وغيّر كلمة المرور من أول ثانية.

PRAGMA foreign_keys = OFF;

DELETE FROM result_approvals WHERE exam_result_id IN (
  SELECT id FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1)
);
DELETE FROM result_details WHERE exam_result_id IN (
  SELECT id FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1)
);
DELETE FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1);
DELETE FROM seating_numbers WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1);
DELETE FROM certificates WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1);
DELETE FROM grade_components WHERE id LIKE 'gc-demo-%';
DELETE FROM exam_subjects WHERE id = 'examsub-demo-1';
DELETE FROM exams WHERE id = 'exam-demo-1';
DELETE FROM exam_types WHERE id = 'examtype-term1';

DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1);
DELETE FROM timetables WHERE id = 'tt-demo-1';
DELETE FROM teacher_subjects WHERE id = 'ts-demo-1';

DELETE FROM student_classes WHERE student_id IN (SELECT id FROM students WHERE is_demo = 1);

DELETE FROM parent_student WHERE
  student_id IN (SELECT id FROM students WHERE is_demo = 1)
  OR parent_id IN (SELECT id FROM parents WHERE is_demo = 1);

DELETE FROM students WHERE is_demo = 1;
DELETE FROM teachers WHERE is_demo = 1;
DELETE FROM parents WHERE is_demo = 1;

DELETE FROM sections WHERE id = 'section-p6-a';
DELETE FROM classes WHERE id = 'class-p6-2025';

DELETE FROM announcements WHERE id IN ('ann-demo-1', 'ann-demo-2');
DELETE FROM activities WHERE id IN ('act-demo-1', 'act-demo-2');

DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1);
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1);
DELETE FROM users WHERE is_demo = 1;

-- حساب إداري حقيقي واحد فقط — كلمة مرور مؤقتة عشوائية (راجع docs/INITIAL_ADMIN.md)
INSERT INTO users (id, username, email, password_hash, role_id, status, is_demo, created_at, updated_at)
VALUES (
  'user-bootstrap-admin',
  'admin',
  NULL,
  '$2b$10$Hx62wOTq4E3vvOJ9bQTnvuB98FcfNf7uCrmtf4sNZC.rixTP2HTpG',
  'role-super-admin',
  'active',
  0,
  datetime('now'),
  datetime('now')
);

-- إعادة ضبط إعدادات المدرسة لقيم محايدة فارغة (وليست بيانات وهمية)
UPDATE school_settings SET
  school_name_ar = 'اسم المدرسة (يُعدَّل من الإعدادات)',
  school_name_en = NULL,
  logo_file_id = NULL,
  ministry = 'وزارة التربية والتعليم',
  education_department = NULL,
  governorate = NULL,
  address = NULL,
  phone = NULL,
  email = NULL,
  founded_year = NULL,
  current_academic_year_id = NULL,
  current_term_id = NULL,
  updated_at = datetime('now')
WHERE id = 'main';

-- ملاحظة: السنوات الدراسية والصفوف/المراحل/المواد وجدول التقديرات لم تُحذف
-- عمدًا؛ فهي إعدادات نظام هيكلية حقيقية تحتاجها أي مدرسة، وقابلة للتعديل
-- الكامل من لوحة الإدارة. لاستبدال السنة الدراسية "2025/2026" بسنتك الفعلية:
-- أنشئ سنة جديدة من لوحة الإدارة، فعّلها كسنة حالية، ثم احذف القديمة إن أردت.

PRAGMA foreign_keys = ON;
