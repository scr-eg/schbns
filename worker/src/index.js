// School Management Platform Worker (API + Public Website + Admin Dashboard)
// No external dependencies — uses Web Crypto API for everything.

// ===== SHA-256 password hashing =====
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== JWT (HMAC-SHA256) =====
function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  let bin = '';
  new Uint8Array(sig).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 7 * 24 * 3600 };
  const data = b64urlEncode(header) + '.' + b64urlEncode(body);
  const sig = await hmacSign(data, secret);
  return data + '.' + sig;
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const data = parts[0] + '.' + parts[1];
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = b64urlDecode(parts[1]);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ===== Response helpers =====
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ===== Auth middleware =====
async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { error: json({ error: 'غير مصرح' }, 401) };
  }
  const payload = await verifyToken(auth.substring(7), env.JWT_SECRET);
  if (!payload) {
    return { error: json({ error: 'جلسة منتهية' }, 401) };
  }
  return { payload };
}

// ===== API handlers =====
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { username, password } = body;
    if (!username || !password) return json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' }, 400);

    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, role_id, status FROM users WHERE username = ? AND deleted_at IS NULL'
    ).bind(username).first();

    if (!user) return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
    if (user.status !== 'active') return json({ error: 'هذا الحساب غير نشط' }, 403);

    // Verify password (SHA-256)
    const hash = await sha256Hex(password);
    if (hash !== user.password_hash) {
      await env.DB.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?').bind(user.id).run();
      return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
    }

    // Get role code
    let roleCode = user.role_id;
    try {
      const role = await env.DB.prepare('SELECT code FROM roles WHERE id = ?').bind(user.role_id).first();
      if (role && role.code) roleCode = role.code;
    } catch (e) { /* role table may differ */ }

    const token = await signToken({ sub: user.id, username: user.username, role: roleCode }, env.JWT_SECRET);
       await env.DB.prepare('UPDATE users SET last_login_at = datetime(\'now\'), failed_login_attempts = 0 WHERE id = ?').bind(user.id).run();


    return json({
      token,
      user: { id: user.id, username: user.username, roleCode },
    });
  } catch (e) {
    return json({ error: 'حدث خطأ غير متوقع: ' + (e.message || 'unknown') }, 500);
  }
}

async function handleMe(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  return json({ user: auth.payload });
}

async function handleStats(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const s = await env.DB.prepare('SELECT COUNT(*) as c FROM students WHERE deleted_at IS NULL').first();
    const t = await env.DB.prepare('SELECT COUNT(*) as c FROM teachers WHERE deleted_at IS NULL').first();
    const cl = await env.DB.prepare('SELECT COUNT(*) as c FROM classes WHERE deleted_at IS NULL').first();
    const p = await env.DB.prepare('SELECT COUNT(*) as c FROM parents WHERE deleted_at IS NULL').first();
    return json({ students: s?.c || 0, teachers: t?.c || 0, classes: cl?.c || 0, parents: p?.c || 0 });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleStudents(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const r = await env.DB.prepare('SELECT id, student_code, full_name, gender, status FROM students WHERE deleted_at IS NULL ORDER BY full_name LIMIT 100').all();
    return json({ students: r.results || [] });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleTeachers(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const r = await env.DB.prepare('SELECT id, full_name, status FROM teachers WHERE deleted_at IS NULL ORDER BY full_name LIMIT 100').all();
    return json({ teachers: r.results || [] });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleClasses(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const r = await env.DB.prepare('SELECT id, name, status FROM classes WHERE deleted_at IS NULL ORDER BY name LIMIT 100').all();
    return json({ classes: r.results || [] });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleAnnouncements(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const r = await env.DB.prepare('SELECT id, title, content, created_at FROM announcements WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20').all();
    return json({ announcements: r.results || [] });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ===== Admin Dashboard (login + dashboard) =====
const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>لوحة التحكم — منصة المدرسة</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; font-family:'Tajawal',sans-serif; }
:root { --primary:#0F5C4C; --primary-light:#1a7a66; --bg:#f0f4f3; --card:#fff; --text:#1a1a1a; --border:#e0e0e0; --danger:#e53935; --success:#43a047; }
body { background:var(--bg); color:var(--text); min-height:100vh; }
.login-container { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
.login-card { background:var(--card); border-radius:20px; box-shadow:0 8px 32px rgba(0,0,0,.1); padding:40px; width:100%; max-width:420px; }
.login-card h1 { color:var(--primary); font-size:28px; text-align:center; margin-bottom:8px; }
.login-card p { text-align:center; color:#666; margin-bottom:30px; font-size:15px; }
.form-group { margin-bottom:20px; }
.form-group label { display:block; margin-bottom:8px; font-weight:500; font-size:14px; }
.form-group input { width:100%; padding:14px 16px; border:2px solid var(--border); border-radius:12px; font-size:16px; transition:border-color .2s; font-family:'Tajawal',sans-serif; }
.form-group input:focus { outline:none; border-color:var(--primary); }
.btn { width:100%; padding:14px; border:none; border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; transition:all .2s; font-family:'Tajawal',sans-serif; }
.btn-primary { background:var(--primary); color:#fff; }
.btn-primary:hover { background:var(--primary-light); transform:translateY(-1px); }
.btn-primary:disabled { opacity:.6; cursor:not-allowed; transform:none; }
.alert { padding:12px 16px; border-radius:10px; margin-bottom:20px; font-size:14px; display:none; }
.alert-error { background:#ffebee; color:var(--danger); display:block; }
.dashboard { display:none; }
.navbar { background:var(--primary); padding:0 24px; height:64px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,.1); position:sticky; top:0; z-index:100; }
.navbar-brand { color:#fff; font-size:20px; font-weight:700; display:flex; align-items:center; gap:10px; }
.navbar-user { display:flex; align-items:center; gap:16px; }
.navbar-user span { color:rgba(255,255,255,.9); font-size:14px; }
.navbar-user button { background:rgba(255,255,255,.15); color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:14px; font-family:'Tajawal',sans-serif; }
.dashboard-content { max-width:1200px; margin:0 auto; padding:24px; }
.page-title { font-size:24px; font-weight:700; margin-bottom:24px; color:var(--primary); }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:20px; margin-bottom:32px; }
.stat-card { background:var(--card); border-radius:16px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; align-items:center; gap:16px; transition:transform .2s; }
.stat-card:hover { transform:translateY(-2px); }
.stat-icon { width:56px; height:56px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:28px; flex-shrink:0; }
.stat-icon.students { background:#e3f2fd; color:#1976d2; }
.stat-icon.teachers { background:#f3e5f5; color:#7b1fa2; }
.stat-icon.classes { background:#e8f5e9; color:#388e3c; }
.stat-icon.parents { background:#fff3e0; color:#f57c00; }
.stat-info h3 { font-size:32px; font-weight:700; }
.stat-info p { color:#666; font-size:14px; }
.card { background:var(--card); border-radius:16px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,.06); margin-bottom:24px; }
.card h2 { font-size:18px; margin-bottom:16px; color:var(--primary); }
table { width:100%; border-collapse:collapse; }
th,td { padding:12px; text-align:right; border-bottom:1px solid var(--border); }
th { color:#666; font-weight:500; font-size:14px; }
td { font-size:14px; }
.badge { padding:4px 12px; border-radius:20px; font-size:12px; font-weight:500; }
.badge-active { background:#e8f5e9; color:#2e7d32; }
.badge-inactive { background:#ffebee; color:#c62828; }
.loading { text-align:center; padding:40px; color:#999; }
.tabs { display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap; }
.tab { padding:10px 20px; border-radius:10px; cursor:pointer; font-size:14px; font-weight:500; background:var(--card); border:2px solid var(--border); transition:all .2s; }
.tab.active { background:var(--primary); color:#fff; border-color:var(--primary); }
.tab-content { display:none; }
.tab-content.active { display:block; }
@media (max-width:768px) { .stats-grid { grid-template-columns:1fr; } .dashboard-content { padding:16px; } }
</style>
</head>
<body>
<div id="loginPage" class="login-container">
  <div class="login-card">
    <h1>🎓 منصة المدرسة</h1>
    <p>سجّل الدخول للوصول إلى لوحة التحكم</p>
    <div id="loginAlert" class="alert"></div>
    <form id="loginForm">
      <div class="form-group"><label>اسم المستخدم</label><input type="text" id="username" placeholder="admin" required autocomplete="username"></div>
      <div class="form-group"><label>كلمة المرور</label><input type="password" id="password" placeholder="••••••••" required autocomplete="current-password"></div>
      <button type="submit" class="btn btn-primary" id="loginBtn">تسجيل الدخول</button>
    </form>
    <p style="text-align:center;margin-top:16px"><a href="/" style="color:var(--primary);font-size:14px;text-decoration:none">← العودة للموقع العام</a></p>
  </div>
</div>

<div id="dashboard" class="dashboard">
  <nav class="navbar">
    <div class="navbar-brand">🎓 منصة المدرسة</div>
    <div class="navbar-user"><span id="userDisplay"></span><a href="/" style="color:rgba(255,255,255,.9);font-size:14px;text-decoration:none;margin-left:8px">الموقع العام</a><button onclick="logout()">خروج</button></div>
  </nav>
  <div class="dashboard-content">
    <h1 class="page-title">لوحة التحكم</h1>
    <div class="stats-grid" id="statsGrid"><div class="loading">جاري التحميل...</div></div>
    <div class="tabs">
      <div class="tab active" onclick="switchTab('students',this)">الطلاب</div>
      <div class="tab" onclick="switchTab('teachers',this)">المعلمون</div>
      <div class="tab" onclick="switchTab('classes',this)">الفصول</div>
      <div class="tab" onclick="switchTab('announcements',this)">الإعلانات</div>
    </div>
    <div id="tab-students" class="tab-content active"><div class="card"><h2>قائمة الطلاب</h2><div id="studentsTable"><div class="loading">جاري التحميل...</div></div></div></div>
    <div id="tab-teachers" class="tab-content"><div class="card"><h2>قائمة المعلمين</h2><div id="teachersTable"><div class="loading">جاري التحميل...</div></div></div></div>
    <div id="tab-classes" class="tab-content"><div class="card"><h2>قائمة الفصول</h2><div id="classesTable"><div class="loading">جاري التحميل...</div></div></div></div>
    <div id="tab-announcements" class="tab-content"><div class="card"><h2>الإعلانات</h2><div id="announcementsList"><div class="loading">جاري التحميل...</div></div></div></div>
  </div>
</div>

<script>
const API = window.location.origin + '/api';
let token = localStorage.getItem('sch_token');
let currentUser = null;

if (token) {
  fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { currentUser = data.user; showDashboard(); })
    .catch(() => { localStorage.removeItem('sch_token'); token = null; });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const alert = document.getElementById('loginAlert');
  alert.className = 'alert';
  btn.disabled = true; btn.textContent = 'جاري التحقق...';
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
    token = data.token; currentUser = data.user;
    localStorage.setItem('sch_token', token);
    showDashboard();
  } catch (err) {
    alert.textContent = err.message; alert.className = 'alert alert-error';
  } finally {
    btn.disabled = false; btn.textContent = 'تسجيل الدخول';
  }
});

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('userDisplay').textContent = currentUser.username + ' (' + (currentUser.roleCode || '') + ')';
  loadStats(); loadStudents(); loadTeachers(); loadClasses(); loadAnnouncements();
}

function logout() { localStorage.removeItem('sch_token'); token = null; location.reload(); }

async function apiGet(path) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

async function loadStats() {
  try {
    const d = await apiGet('/dashboard/stats');
    document.getElementById('statsGrid').innerHTML = [
      ['students','👨‍🎓',d.students,'طلاب'],
      ['teachers','👩‍🏫',d.teachers,'معلمين'],
      ['classes','🏫',d.classes,'فصول'],
      ['parents','👨‍👩‍👧',d.parents,'أولياء أمور'],
    ].map(x => '<div class="stat-card"><div class="stat-icon '+x[0]+'">'+x[1]+'</div><div class="stat-info"><h3>'+x[2]+'</h3><p>'+x[3]+'</p></div></div>').join('');
  } catch { document.getElementById('statsGrid').innerHTML = '<div class="loading">تعذر تحميل الإحصائيات</div>'; }
}

async function loadStudents() {
  try {
    const d = await apiGet('/students');
    const rows = (d.students||[]).map(s => '<tr><td>'+(s.student_code||'-')+'</td><td>'+(s.full_name||'-')+'</td><td>'+(s.gender==='male'?'ذكر':'أنثى')+'</td><td><span class="badge '+(s.status==='active'?'badge-active':'badge-inactive')+'">'+(s.status==='active'?'نشط':'غير نشط')+'</span></td></tr>').join('');
    document.getElementById('studentsTable').innerHTML = '<table><thead><tr><th>كود</th><th>الاسم</th><th>النوع</th><th>الحالة</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" style="text-align:center;color:#999">لا يوجد طلاب</td></tr>')+'</tbody></table>';
  } catch { document.getElementById('studentsTable').innerHTML = '<div class="loading">تعذر التحميل</div>'; }
}

async function loadTeachers() {
  try {
    const d = await apiGet('/teachers');
    const rows = (d.teachers||[]).map(t => '<tr><td>'+(t.full_name||'-')+'</td><td><span class="badge '+(t.status==='active'?'badge-active':'badge-inactive')+'">'+(t.status==='active'?'نشط':'غير نشط')+'</span></td></tr>').join('');
    document.getElementById('teachersTable').innerHTML = '<table><thead><tr><th>الاسم</th><th>الحالة</th></tr></thead><tbody>'+(rows||'<tr><td colspan="2" style="text-align:center;color:#999">لا يوجد معلمين</td></tr>')+'</tbody></table>';
  } catch { document.getElementById('teachersTable').innerHTML = '<div class="loading">تعذر التحميل</div>'; }
}

async function loadClasses() {
  try {
    const d = await apiGet('/classes');
    const rows = (d.classes||[]).map(c => '<tr><td>'+(c.name||'-')+'</td><td><span class="badge '+(c.status==='active'?'badge-active':'badge-inactive')+'">'+(c.status==='active'?'نشط':'غير نشط')+'</span></td></tr>').join('');
    document.getElementById('classesTable').innerHTML = '<table><thead><tr><th>الاسم</th><th>الحالة</th></tr></thead><tbody>'+(rows||'<tr><td colspan="2" style="text-align:center;color:#999">لا يوجد فصول</td></tr>')+'</tbody></table>';
  } catch { document.getElementById('classesTable').innerHTML = '<div class="loading">تعذر التحميل</div>'; }
}

async function loadAnnouncements() {
  try {
    const d = await apiGet('/announcements');
    const items = (d.announcements||[]).map(a => '<div style="padding:16px;border-bottom:1px solid #e0e0e0"><strong>'+(a.title||'')+'</strong><p style="color:#666;margin-top:4px;font-size:14px">'+(a.content||'')+'</p><small style="color:#999">'+(a.created_at||'')+'</small></div>').join('');
    document.getElementById('announcementsList').innerHTML = items || '<div class="loading">لا يوجد إعلانات</div>';
  } catch { document.getElementById('announcementsList').innerHTML = '<div class="loading">تعذر التحميل</div>'; }
}

function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}
</script>
</body>
</html>`;

// ===== Public website (for everyone) =====
const PUBLIC_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مدرسة المستقبل — منصة تعليمية متكاملة</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; font-family:'Tajawal',sans-serif; }
:root { --primary:#0F5C4C; --primary-light:#1a7a66; --accent:#f5a623; --bg:#f8faf9; --dark:#0d2b24; --text:#333; }
body { background:var(--bg); color:var(--text); }
.navbar { background:var(--primary); padding:0 24px; height:72px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.15); }
.navbar-brand { color:#fff; font-size:22px; font-weight:700; display:flex; align-items:center; gap:10px; }
.navbar-links { display:flex; gap:24px; align-items:center; }
.navbar-links a { color:rgba(255,255,255,.9); text-decoration:none; font-size:15px; font-weight:500; transition:color .2s; }
.navbar-links a:hover { color:var(--accent); }
.navbar-links .btn-login { background:var(--accent); color:var(--dark); padding:10px 20px; border-radius:10px; font-weight:700; }
.navbar-links .btn-login:hover { background:#ffb84d; color:var(--dark); }
.hero { background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%); color:#fff; padding:80px 24px; text-align:center; }
.hero h1 { font-size:44px; font-weight:700; margin-bottom:16px; }
.hero p { font-size:19px; color:rgba(255,255,255,.9); max-width:700px; margin:0 auto 32px; line-height:1.8; }
.hero .btn { display:inline-block; background:var(--accent); color:var(--dark); padding:14px 36px; border-radius:12px; text-decoration:none; font-weight:700; font-size:17px; transition:transform .2s; }
.hero .btn:hover { transform:translateY(-2px); }
.features { max-width:1100px; margin:0 auto; padding:64px 24px; }
.features h2 { text-align:center; font-size:30px; color:var(--primary); margin-bottom:40px; }
.features-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:24px; }
.feature-card { background:#fff; border-radius:16px; padding:28px; box-shadow:0 4px 16px rgba(0,0,0,.06); text-align:center; transition:transform .2s; }
.feature-card:hover { transform:translateY(-4px); }
.feature-icon { font-size:40px; margin-bottom:12px; }
.feature-card h3 { color:var(--primary); font-size:18px; margin-bottom:8px; }
.feature-card p { color:#666; font-size:14px; line-height:1.7; }
.announcements { background:#fff; padding:64px 24px; }
.announcements h2 { text-align:center; font-size:30px; color:var(--primary); margin-bottom:40px; }
.announcements-list { max-width:800px; margin:0 auto; }
.ann-item { background:var(--bg); border-radius:12px; padding:20px 24px; margin-bottom:12px; border-right:4px solid var(--primary); }
.ann-item h3 { color:var(--primary); font-size:16px; margin-bottom:4px; }
.ann-item p { color:#666; font-size:14px; }
.ann-item small { color:#999; font-size:12px; }
.stats { background:var(--dark); color:#fff; padding:48px 24px; }
.stats-grid { max-width:900px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:24px; text-align:center; }
.stat h3 { font-size:36px; color:var(--accent); }
.stat p { color:rgba(255,255,255,.8); font-size:15px; margin-top:4px; }
.contact { max-width:800px; margin:0 auto; padding:64px 24px; text-align:center; }
.contact h2 { font-size:30px; color:var(--primary); margin-bottom:16px; }
.contact p { color:#666; margin-bottom:32px; }
.contact-info { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; }
.contact-item { background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.06); }
.contact-item .icon { font-size:28px; margin-bottom:8px; }
.contact-item h4 { color:var(--primary); font-size:15px; margin-bottom:4px; }
.contact-item p { color:#666; font-size:14px; margin:0; }
.footer { background:var(--primary); color:rgba(255,255,255,.9); text-align:center; padding:24px; font-size:14px; }
.footer a { color:var(--accent); text-decoration:none; }
@media (max-width:768px) { .hero h1 { font-size:30px; } .navbar-links { gap:12px; } .navbar-links a { font-size:13px; } }
</style>
</head>
<body>
<nav class="navbar">
  <div class="navbar-brand">🏫 مدرسة المستقبل</div>
  <div class="navbar-links">
    <a href="#features">مميزاتنا</a>
    <a href="#announcements">الإعلانات</a>
    <a href="#contact">تواصل معنا</a>
    <a href="/admin" class="btn-login">دخول الإدارة</a>
  </div>
</nav>

<section class="hero">
  <h1>مرحباً بكم في مدرسة المستقبل</h1>
  <p>منصة تعليمية متكاملة تجمع الطلاب والمعلمين وأولياء الأمور في مكان واحد — متابعة الحضور، الامتحانات، النتائج، والجداول الدراسية بكل سهولة.</p>
  <a href="/admin" class="btn">دخول لوحة التحكم</a>
</section>

<section class="features" id="features">
  <h2>ماذا نقدم؟</h2>
  <div class="features-grid">
    <div class="feature-card"><div class="feature-icon">📚</div><h3>إدارة أكاديمية</h3><p>جداول دراسية، امتحانات، درجات، ونتائج نهائية منظمة وواضحة.</p></div>
    <div class="feature-card"><div class="feature-icon">👨‍🏫</div><h3>متابعة المعلمين</h3><p>إدارة بيانات المعلمين وتوزيع المواد الدراسية والفصول.</p></div>
    <div class="feature-card"><div class="feature-icon">👨‍🎓</div><h3>متابعة الطلاب</h3><p>سجلات الطلاب، الحضور والغياب، والأنشطة المدرسية.</p></div>
    <div class="feature-card"><div class="feature-icon">👨‍👩‍👧</div><h3>أولياء الأمور</h3><p>تواصل مباشر مع المدرسة ومتابعة أداء الأبناء أولاً بأول.</p></div>
  </div>
</section>

<section class="stats">
  <div class="stats-grid">
    <div class="stat"><h3>+500</h3><p>طالب وطالبة</p></div>
    <div class="stat"><h3>+40</h3><p>معلم ومعلمة</p></div>
    <div class="stat"><h3>+20</h3><p>فصلاً دراسياً</p></div>
    <div class="stat"><h3>+15</h3><p>عاماً من التميز</p></div>
  </div>
</section>

<section class="announcements" id="announcements">
  <h2>آخر الإعلانات</h2>
  <div class="announcements-list" id="annList"><p style="text-align:center;color:#999">جاري التحميل...</p></div>
</section>

<section class="contact" id="contact">
  <h2>تواصل معنا</h2>
  <p>نحن هنا لخدمتكم — لا تترددوا في التواصل معنا</p>
  <div class="contact-info">
    <div class="contact-item"><div class="icon">📍</div><h4>العنوان</h4><p>شارع المدرسة، المدينة</p></div>
    <div class="contact-item"><div class="icon">📞</div><h4>الهاتف</h4><p>0100 000 0000</p></div>
    <div class="contact-item"><div class="icon">✉️</div><h4>البريد</h4><p>info@school.com</p></div>
  </div>
</section>

<footer class="footer">
  <p>© 2026 مدرسة المستقبل — جميع الحقوق محفوظة | <a href="/admin">دخول الإدارة</a></p>
</footer>

<script>
fetch('/api/public/announcements')
  .then(r => r.json())
  .then(d => {
    const list = document.getElementById('annList');
    if (!d.announcements || d.announcements.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#999">لا توجد إعلانات حالياً</p>';
      return;
    }
    list.innerHTML = d.announcements.map(a =>
      '<div class="ann-item"><h3>' + (a.title || '') + '</h3><p>' + (a.content || '') + '</p><small>' + (a.created_at || '') + '</small></div>'
    ).join('');
  })
  .catch(() => {
    document.getElementById('annList').innerHTML = '<p style="text-align:center;color:#999">لا توجد إعلانات حالياً</p>';
  });
</script>
</body>
</html>`;

// ===== Main fetch handler =====
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // API routes
    if (path.startsWith('/api/')) {
      const route = path.substring(5);
      if (route === 'health' && request.method === 'GET') {
        return json({ status: 'ok', env: env.ENVIRONMENT, time: new Date().toISOString() }, 200, corsHeaders);
      }
      if (route === 'public/announcements' && request.method === 'GET') {
        try {
          const r = await env.DB.prepare('SELECT id, title, content, created_at FROM announcements WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10').all();
          return json({ announcements: r.results || [] }, 200, corsHeaders);
        } catch (e) {
          return json({ announcements: [] }, 200, corsHeaders);
        }
      }
      if (route === 'auth/login' && request.method === 'POST') {
        const res = await handleLogin(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'auth/me' && request.method === 'GET') {
        const res = await handleMe(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'auth/logout' && request.method === 'POST') {
        return json({ success: true }, 200, corsHeaders);
      }
      if (route === 'dashboard/stats' && request.method === 'GET') {
        const res = await handleStats(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'students' && request.method === 'GET') {
        const res = await handleStudents(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'teachers' && request.method === 'GET') {
        const res = await handleTeachers(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'classes' && request.method === 'GET') {
        const res = await handleClasses(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === 'announcements' && request.method === 'GET') {
        const res = await handleAnnouncements(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHeaders } });
      }
      if (route === '' || route === 'api') {
        return json({ name: 'School Management API', version: '1.0', endpoints: ['/api/health', '/api/auth/login', '/api/auth/me', '/api/dashboard/stats', '/api/students', '/api/teachers', '/api/classes', '/api/announcements'] }, 200, corsHeaders);
      }
      return json({ error: 'NOT_FOUND' }, 404, corsHeaders);
    }

    // Admin dashboard — served at /admin
    if (path === '/admin' || path === '/admin/') {
      return html(FRONTEND_HTML);
    }

    // Public website — served at root and all other paths
    return html(PUBLIC_HTML);
  },
};
