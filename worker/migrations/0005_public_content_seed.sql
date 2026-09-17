-- ============================================================
-- Migration 0005: بيانات تجريبية للموقع العام (أخبار/إعلانات/أنشطة) — DEMO DATA
-- ============================================================

INSERT INTO announcements (id, title, body, audience, status, created_by, created_at) VALUES
 ('ann-demo-1', 'بدء التسجيل للعام الدراسي الجديد (تجريبي)',
  'تعلن المدرسة عن بدء التسجيل للعام الدراسي 2025/2026 لجميع المراحل. هذا إعلان تجريبي ضمن بيانات العرض.',
  'all', 'published', 'user-admin-demo', datetime('now', '-2 day')),
 ('ann-demo-2', 'مواعيد امتحانات منتصف الترم الأول (تجريبي)',
  'تبدأ امتحانات منتصف الترم الأول يوم الأحد القادم وفق الجدول المعلن على بوابة الطالب. بيانات تجريبية.',
  'students', 'published', 'user-controller-demo', datetime('now', '-1 day'));

INSERT INTO activities (id, title, description, category, activity_date, created_by) VALUES
 ('act-demo-1', 'يوم رياضي مدرسي (تجريبي)', 'فعالية رياضية تجريبية لجميع المراحل.', 'sports',
  date('now', '+10 day'), 'user-admin-demo'),
 ('act-demo-2', 'معرض الفنون التشكيلية (تجريبي)', 'عرض أعمال الطلاب الفنية. بيانات تجريبية.', 'arts',
  date('now', '+20 day'), 'user-admin-demo');
