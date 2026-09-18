-- ============================================================
-- Migration 0009: امتحان تجريبي كامل لتجربة سير عمل الكنترول (DEMO DATA)
-- ============================================================

INSERT INTO exam_types (id, name_ar, name_en) VALUES
 ('examtype-term1', 'امتحان آخر الترم الأول', 'End of Term 1 Exam');

INSERT INTO exams (id, academic_year_id, term_id, exam_type_id, grade_id, name, start_date, end_date, status)
VALUES ('exam-demo-1', 'ay-2025-2026', 'term-1-2025', 'examtype-term1', 'grade-p6',
        'امتحان آخر الترم الأول - الصف السادس الابتدائي (تجريبي)', '2025-12-15', '2025-12-20', 'scheduled');

-- ربط مادة اللغة العربية بالامتحان التجريبي (الدرجة النهائية 100، درجة النجاح 50)
INSERT INTO exam_subjects (id, exam_id, subject_id, max_score, pass_score, exam_date)
VALUES ('examsub-demo-1', 'exam-demo-1', 'subj-arabic', 100, 50, '2025-12-16');

-- مكوّنات الدرجة لمادة اللغة العربية (قابلة للتعديل الكامل من لوحة الأدمن)
INSERT INTO grade_components (id, subject_id, grade_id, academic_year_id, term_id, component_name, max_score, order_index)
VALUES
 ('gc-demo-1', 'subj-arabic', 'grade-p6', 'ay-2025-2026', 'term-1-2025', 'أعمال السنة', 40, 1),
 ('gc-demo-2', 'subj-arabic', 'grade-p6', 'ay-2025-2026', 'term-1-2025', 'الامتحان النهائي', 60, 2);

-- توليد رقم جلوس للطالب التجريبي في هذا الامتحان (محاكاة لما يفعله زر "توليد أرقام الجلوس")
INSERT INTO seating_numbers (id, exam_id, student_id, seat_number)
VALUES ('seat-demo-1', 'exam-demo-1', 'student-demo-1', '1001');
