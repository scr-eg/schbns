-- ============================================================
-- Migration 0008: صلاحية التعديل الاستثنائي على نتيجة مُقفلة (Locked) — super_admin فقط
-- ============================================================
INSERT INTO permissions (id, code, description) VALUES
 ('perm-results-override', 'results.override', 'تعديل نتيجة بعد قفلها (استثنائي وموثّق بالكامل)');

INSERT INTO role_permissions (role_id, permission_id) VALUES
 ('role-super-admin', 'perm-results-override');
