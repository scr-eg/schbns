-- ============================================================
-- Migration 0007: جدول التقديرات القابل للتخصيص بالكامل من الأدمن (Grade Scale)
-- لا نفترض نظام تقدير ثابت؛ هذا الجدول قابل للتعديل بالكامل دون تعديل الكود
-- ============================================================

CREATE TABLE grade_scale (
  id TEXT PRIMARY KEY,
  min_percentage REAL NOT NULL,
  max_percentage REAL NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  order_index INTEGER NOT NULL
);

-- قيمة افتراضية قابلة للتعديل الكامل من لوحة الأدمن لاحقًا (Phase غير مطلوبة الآن لواجهتها،
-- لكن الـ API جاهز في routes/grading.ts)
INSERT INTO grade_scale (id, min_percentage, max_percentage, label_ar, label_en, order_index) VALUES
 ('scale-1', 90, 100.01, 'ممتاز', 'Excellent', 1),
 ('scale-2', 80, 90,     'جيد جدًا', 'Very Good', 2),
 ('scale-3', 65, 80,     'جيد', 'Good', 3),
 ('scale-4', 50, 65,     'مقبول', 'Acceptable', 4),
 ('scale-5', 0,  50,     'ضعيف', 'Weak', 5);

CREATE INDEX idx_grade_scale_range ON grade_scale(min_percentage, max_percentage);
