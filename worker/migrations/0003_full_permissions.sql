-- ============================================================
-- Migration 0003: استكمال الصلاحيات الكاملة (Phase 2)
-- يطابق docs/ROLES_MATRIX.md بالكامل
-- ============================================================

INSERT INTO permissions (id, code, description) VALUES
 ('perm-students-read-own',   'students.read_own',    'عرض بيانات الطالب لنفسه فقط'),
 ('perm-students-read-child', 'students.read_child',  'عرض بيانات الأبناء لولي الأمر'),
 ('perm-teachers-crud',       'teachers.crud',         'إدارة كاملة لبيانات المعلمين'),
 ('perm-teachers-read',       'teachers.read',         'عرض بيانات المعلمين'),
 ('perm-parents-crud',        'parents.crud',          'إدارة بيانات أولياء الأمور'),
 ('perm-classes-crud',        'classes.crud',          'إدارة الصفوف والفصول'),
 ('perm-classes-read',        'classes.read',          'عرض الصفوف والفصول'),
 ('perm-subjects-crud',       'subjects.crud',         'إدارة المواد الدراسية'),
 ('perm-timetable-crud',      'timetable.crud',        'إدارة الجداول الدراسية'),
 ('perm-timetable-read',      'timetable.read',        'عرض الجداول الدراسية'),
 ('perm-attendance-record',   'attendance.record',     'تسجيل الحضور والغياب'),
 ('perm-attendance-read',     'attendance.read',       'عرض تقارير الحضور'),
 ('perm-attendance-read-own', 'attendance.read_own',   'عرض حضور الطالب/الابن نفسه'),
 ('perm-exams-manage',        'exams.manage',          'إنشاء وإدارة الامتحانات واللجان'),
 ('perm-exams-read',          'exams.read',            'عرض بيانات الامتحانات'),
 ('perm-certificates-issue',  'certificates.issue',    'إصدار الشهادات'),
 ('perm-certificates-read-own','certificates.read_own','تحميل شهادات الطالب نفسه'),
 ('perm-reports-read',        'reports.read',          'عرض التقارير العامة'),
 ('perm-reports-read-limited','reports.read_limited',  'عرض تقارير محدودة النطاق'),
 ('perm-announcements-crud',  'announcements.crud',    'إدارة الأخبار والإعلانات'),
 ('perm-announcements-read',  'announcements.read',    'عرض الأخبار والإعلانات'),
 ('perm-activities-crud',     'activities.crud',       'إدارة الأنشطة'),
 ('perm-backup-manage',       'backup.manage',         'إدارة النسخ الاحتياطي');

-- ---------- ربط الأدوار بالصلاحيات وفق docs/ROLES_MATRIX.md ----------

-- super_admin: كل شيء (تمت إضافة الأساسيات في 0002، نكمل الباقي)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-super-admin', id FROM permissions
WHERE code NOT IN (
  SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.role_id = 'role-super-admin'
);

-- school_admin
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-school-admin','perm-teachers-crud'), ('role-school-admin','perm-parents-crud'),
 ('role-school-admin','perm-classes-crud'), ('role-school-admin','perm-subjects-crud'),
 ('role-school-admin','perm-timetable-crud'), ('role-school-admin','perm-attendance-read'),
 ('role-school-admin','perm-exams-read'), ('role-school-admin','perm-reports-read'),
 ('role-school-admin','perm-announcements-crud'), ('role-school-admin','perm-activities-crud'),
 ('role-school-admin','perm-users-manage'), ('role-school-admin','perm-audit-read');

-- principal
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-principal','perm-students-read'), ('role-principal','perm-teachers-read'),
 ('role-principal','perm-classes-read'), ('role-principal','perm-timetable-read'),
 ('role-principal','perm-attendance-read'), ('role-principal','perm-exams-read'),
 ('role-principal','perm-results-approve'), ('role-principal','perm-reports-read'),
 ('role-principal','perm-announcements-read'), ('role-principal','perm-audit-read');

-- vice_principal
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-vice-principal','perm-students-read'), ('role-vice-principal','perm-timetable-crud'),
 ('role-vice-principal','perm-attendance-read'), ('role-vice-principal','perm-results-approve'),
 ('role-vice-principal','perm-reports-read'), ('role-vice-principal','perm-announcements-crud');

-- exam_controller
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-controller','perm-exams-manage'), ('role-controller','perm-exams-read'),
 ('role-controller','perm-certificates-issue'), ('role-controller','perm-reports-read-limited'),
 ('role-controller','perm-audit-read');

-- teacher
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-teacher','perm-classes-read'), ('role-teacher','perm-timetable-read'),
 ('role-teacher','perm-attendance-record'), ('role-teacher','perm-exams-read'),
 ('role-teacher','perm-announcements-read'), ('role-teacher','perm-activities-crud');

-- student
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-student','perm-students-read-own'), ('role-student','perm-timetable-read'),
 ('role-student','perm-attendance-read-own'), ('role-student','perm-certificates-read-own'),
 ('role-student','perm-announcements-read');

-- parent
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-parent','perm-students-read-child'), ('role-parent','perm-timetable-read'),
 ('role-parent','perm-attendance-read-own'), ('role-parent','perm-certificates-read-own'),
 ('role-parent','perm-announcements-read');

-- student_affairs
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-student-affairs','perm-students-crud'), ('role-student-affairs','perm-students-read'),
 ('role-student-affairs','perm-reports-read-limited');

-- hr
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-hr','perm-teachers-crud');

-- activity_manager
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-activity','perm-activities-crud'), ('role-activity','perm-announcements-read');

-- counselor
INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-counselor','perm-students-read'), ('role-counselor','perm-attendance-read');
