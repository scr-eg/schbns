-- ============================================================
-- Migration 0002: بيانات أولية (أدوار/صلاحيات) + بيانات تجريبية DEMO DATA
-- ⚠️ كل البيانات هنا بيانات تجريبية وهمية بالكامل (is_demo = 1)
-- كلمة مرور كل حسابات الديمو: Demo@12345 (غيّرها فورًا في الإنتاج)
-- ============================================================

-- ---------- الأدوار ----------
INSERT INTO roles (id, code, name_ar, name_en) VALUES
 ('role-super-admin',   'super_admin',     'مسؤول النظام العام', 'Super Admin'),
 ('role-school-admin',  'school_admin',    'مسؤول المدرسة',       'School Admin'),
 ('role-principal',     'principal',       'مدير المدرسة',        'Principal'),
 ('role-vice-principal','vice_principal',  'وكيل المدرسة',        'Vice Principal'),
 ('role-controller',    'exam_controller', 'مسؤول الكنترول',      'Examination Controller'),
 ('role-teacher',       'teacher',         'معلم',                'Teacher'),
 ('role-student',       'student',         'طالب',                'Student'),
 ('role-parent',        'parent',          'ولي أمر',             'Parent'),
 ('role-student-affairs','student_affairs','شؤون الطلبة',         'Student Affairs'),
 ('role-hr',            'hr',              'شؤون العاملين',       'HR'),
 ('role-accountant',    'accountant',      'الشؤون المالية',      'Accountant'),
 ('role-activity',      'activity_manager','مسؤول الأنشطة',       'Activity Manager'),
 ('role-counselor',     'counselor',       'الأخصائي',            'Counselor'),
 ('role-viewer',        'viewer',          'مستخدم للعرض فقط',    'Viewer');

-- ---------- الصلاحيات الأساسية (نموذج أولي - يُستكمل في Phase 2) ----------
INSERT INTO permissions (id, code, description) VALUES
 ('perm-students-crud',    'students.crud',     'إدارة كاملة لبيانات الطلاب'),
 ('perm-students-read',    'students.read',     'عرض بيانات الطلاب'),
 ('perm-results-enter',    'results.enter',     'إدخال الدرجات'),
 ('perm-results-review',   'results.review',    'مراجعة الدرجات'),
 ('perm-results-approve',  'results.approve',   'اعتماد ونشر النتائج'),
 ('perm-results-read-own', 'results.read_own',  'عرض النتائج الخاصة فقط'),
 ('perm-settings-manage',  'settings.manage',   'إدارة إعدادات المدرسة'),
 ('perm-users-manage',     'users.manage',      'إدارة المستخدمين والأدوار'),
 ('perm-audit-read',       'audit.read',        'عرض سجل العمليات');

INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-super-admin','perm-students-crud'), ('role-super-admin','perm-results-approve'),
 ('role-super-admin','perm-settings-manage'), ('role-super-admin','perm-users-manage'),
 ('role-super-admin','perm-audit-read'),
 ('role-school-admin','perm-students-crud'), ('role-school-admin','perm-settings-manage'),
 ('role-controller','perm-results-review'), ('role-controller','perm-results-approve'),
 ('role-teacher','perm-results-enter'), ('role-teacher','perm-students-read'),
 ('role-student','perm-results-read-own'), ('role-parent','perm-results-read-own');

-- ---------- إعدادات المدرسة الافتراضية (بيانات تجريبية) ----------
INSERT INTO school_settings (id, school_name_ar, school_name_en, governorate, address, phone, email)
VALUES ('main', 'مدرسة النيل للتعليم المتميز (بيانات تجريبية)', 'Nile School for Excellence (DEMO)',
        'القاهرة', 'عنوان تجريبي - شارع النموذج، القاهرة', '0100-000-0000', 'demo@example.com');

-- ---------- المراحل والصفوف ----------
INSERT INTO stages (id, code, name_ar, name_en, order_index) VALUES
 ('stage-primary', 'primary', 'المرحلة الابتدائية', 'Primary', 1),
 ('stage-prep',    'preparatory', 'المرحلة الإعدادية', 'Preparatory', 2),
 ('stage-sec',     'secondary', 'المرحلة الثانوية', 'Secondary', 3);

INSERT INTO grades (id, stage_id, name_ar, name_en, order_index) VALUES
 ('grade-p1','stage-primary','الأول الابتدائي','Grade 1',1),
 ('grade-p2','stage-primary','الثاني الابتدائي','Grade 2',2),
 ('grade-p3','stage-primary','الثالث الابتدائي','Grade 3',3),
 ('grade-p4','stage-primary','الرابع الابتدائي','Grade 4',4),
 ('grade-p5','stage-primary','الخامس الابتدائي','Grade 5',5),
 ('grade-p6','stage-primary','السادس الابتدائي','Grade 6',6),
 ('grade-prep1','stage-prep','الأول الإعدادي','Prep 1',7),
 ('grade-prep2','stage-prep','الثاني الإعدادي','Prep 2',8),
 ('grade-prep3','stage-prep','الثالث الإعدادي','Prep 3',9),
 ('grade-sec1','stage-sec','الأول الثانوي','Sec 1',10),
 ('grade-sec2','stage-sec','الثاني الثانوي','Sec 2',11),
 ('grade-sec3','stage-sec','الثالث الثانوي','Sec 3',12);

-- ---------- سنة دراسية وترم تجريبي ----------
INSERT INTO academic_years (id, name, start_date, end_date, is_current)
VALUES ('ay-2025-2026', '2025/2026', '2025-09-01', '2026-06-30', 1);

INSERT INTO terms (id, academic_year_id, name, order_index, is_current) VALUES
 ('term-1-2025', 'ay-2025-2026', 'الترم الأول', 1, 1),
 ('term-2-2025', 'ay-2025-2026', 'الترم الثاني', 2, 0);

UPDATE school_settings SET current_academic_year_id = 'ay-2025-2026', current_term_id = 'term-1-2025' WHERE id = 'main';

-- ---------- فصل ومادة تجريبية ----------
INSERT INTO classes (id, grade_id, academic_year_id, name_ar) VALUES
 ('class-p6-2025', 'grade-p6', 'ay-2025-2026', 'الصف السادس الابتدائي');
INSERT INTO sections (id, class_id, name, capacity) VALUES
 ('section-p6-a', 'class-p6-2025', 'أ', 30);

INSERT INTO subjects (id, code, name_ar, name_en, subject_type) VALUES
 ('subj-arabic', 'AR', 'اللغة العربية', 'Arabic', 'main'),
 ('subj-math',   'MATH', 'الرياضيات', 'Mathematics', 'main'),
 ('subj-english','EN', 'اللغة الإنجليزية', 'English', 'main');

-- ---------- حسابات تجريبية (DEMO) — كلمة المرور: Demo@12345 ----------
-- الـ hash التالي تم توليده بـ bcrypt (rounds=10) لكلمة المرور Demo@12345
INSERT INTO users (id, username, email, password_hash, role_id, status, is_demo)
VALUES
 ('user-admin-demo',      'admin.demo',      'admin.demo@example.com',      '$2b$10$v1Dd6WRJisdGgM6WpIAKPujWzPVP22VylbTR5vj1//ySYRdFG6SUW', 'role-super-admin', 'active', 1),
 ('user-controller-demo', 'controller.demo', 'controller.demo@example.com', '$2b$10$v1Dd6WRJisdGgM6WpIAKPujWzPVP22VylbTR5vj1//ySYRdFG6SUW', 'role-controller',  'active', 1),
 ('user-teacher-demo',    'teacher.demo',    'teacher.demo@example.com',    '$2b$10$v1Dd6WRJisdGgM6WpIAKPujWzPVP22VylbTR5vj1//ySYRdFG6SUW', 'role-teacher',     'active', 1),
 ('user-student-demo',    'student.demo',    'student.demo@example.com',    '$2b$10$v1Dd6WRJisdGgM6WpIAKPujWzPVP22VylbTR5vj1//ySYRdFG6SUW', 'role-student',     'active', 1),
 ('user-parent-demo',     'parent.demo',     'parent.demo@example.com',     '$2b$10$v1Dd6WRJisdGgM6WpIAKPujWzPVP22VylbTR5vj1//ySYRdFG6SUW', 'role-parent',      'active', 1);

-- ---------- طالب وولي أمر ومعلم تجريبيون (بيانات وهمية بالكامل) ----------
INSERT INTO teachers (id, full_name, phone, email) VALUES
 ('teacher-demo-1', 'أ. أحمد سالم (تجريبي)', '0100-111-2222', 'ahmed.teacher.demo@example.com');

INSERT INTO students (id, student_code, full_name, birth_date, gender, status, current_stage_id, is_demo) VALUES
 ('student-demo-1', 'STU-0001', 'يوسف كريم (طالب تجريبي)', '2014-03-15', 'male', 'enrolled', 'stage-primary', 1);

INSERT INTO parents (id, full_name, phone, email, is_demo) VALUES
 ('parent-demo-1', 'كريم عبد الله (ولي أمر تجريبي)', '0100-333-4444', 'karim.parent.demo@example.com', 1);

INSERT INTO parent_student (parent_id, student_id, relationship) VALUES
 ('parent-demo-1', 'student-demo-1', 'father');

INSERT INTO student_classes (id, student_id, section_id, academic_year_id) VALUES
 ('sc-demo-1', 'student-demo-1', 'section-p6-a', 'ay-2025-2026');

INSERT INTO teacher_subjects (id, teacher_id, subject_id, section_id, academic_year_id) VALUES
 ('ts-demo-1', 'teacher-demo-1', 'subj-arabic', 'section-p6-a', 'ay-2025-2026');
