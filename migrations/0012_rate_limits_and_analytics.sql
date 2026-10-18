-- حدّ معدّل الطلبات (Rate Limiting) على مسارات حساسة
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,   -- بداية النافذة (ثواني Unix)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- إحصائيات الزوار (بدون تخزين IP خام: بصمة يومية مجهولة مُملَّحة)
CREATE TABLE IF NOT EXISTS site_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_date TEXT NOT NULL,        -- YYYY-MM-DD بتوقيت القاهرة
  visitor_hash TEXT NOT NULL,      -- هاش (IP + UA + تاريخ اليوم + ملح سري) يتغير يوميًا
  path TEXT NOT NULL,
  device TEXT NOT NULL CHECK (device IN ('mobile','desktop','tablet')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_visits_date ON site_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_site_visits_date_visitor ON site_visits(visit_date, visitor_hash);

-- صلاحية عرض الإحصائيات: للمدير العام فقط
INSERT OR IGNORE INTO permissions (id, code, description)
  VALUES ('perm-analytics-read', 'analytics.read', 'عرض إحصائيات الزوار');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, 'perm-analytics-read' FROM roles r WHERE r.code = 'super_admin';
