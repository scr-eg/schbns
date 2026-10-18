-- ============================================================
-- Migration 0004: إضافة سنة التأسيس لإعدادات المدرسة (لعرض سنوات الخبرة في الموقع العام)
-- ============================================================
ALTER TABLE school_settings ADD COLUMN founded_year INTEGER;

UPDATE school_settings SET founded_year = 2010 WHERE id = 'main'; -- قيمة تجريبية (DEMO)
