-- ============================================================
-- Migration 0006: بيانات تجريبية للجدول الدراسي (DEMO DATA)
-- تتيح تجربة صفحة "تسجيل الحضور" لحساب teacher.demo فورًا
-- ============================================================

-- ربط user-teacher-demo بسجل teacher-demo-1 (كان بدون ربط منذ الـ seed الأول)
UPDATE users SET linked_entity_type = 'teacher', linked_entity_id = 'teacher-demo-1'
WHERE id = 'user-teacher-demo';

-- ربط user-student-demo وuser-parent-demo بسجلاتهم أيضًا لتفعيل "عرض بياناتي فقط"
UPDATE users SET linked_entity_type = 'student', linked_entity_id = 'student-demo-1'
WHERE id = 'user-student-demo';
UPDATE users SET linked_entity_type = 'parent', linked_entity_id = 'parent-demo-1'
WHERE id = 'user-parent-demo';

INSERT INTO timetables (id, section_id, subject_id, teacher_id, day_of_week, period_index, room, academic_year_id)
VALUES ('tt-demo-1', 'section-p6-a', 'subj-arabic', 'teacher-demo-1', 0, 1, 'فصل 6/أ', 'ay-2025-2026');
