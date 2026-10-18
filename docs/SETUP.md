# دليل التنفيذ والنشر — Cloudflare Pages + Functions + D1 + Google Drive

الموقع والـ API يُنشران **معًا تلقائيًا** من مستودع GitHub عبر Cloudflare Pages.
**لا يوجد Worker منفصل ولا أمر `wrangler deploy`.** الأوامر الوحيدة المطلوبة:
إنشاء قاعدة D1 وتطبيق الجداول مرة واحدة. استخدم `cmd` (يعمل نفسه في PowerShell/Terminal).

⏱️ الوقت المتوقع: 40 دقيقة.

```
1) تثبيت الأدوات        5) أسرار الإنتاج (لوحة Cloudflare)
2) رفع المشروع GitHub    6) ربط Pages بالمستودع (الخطوة اليدوية الأخيرة)
3) إنشاء D1 + الجداول    7) أسرار GitHub Actions (migrations + نسخ احتياطي)
4) Google Apps Script    8) التحقق النهائي
```

> 🔒 **قاعدة أمان:** المستودع لا يحتوي أي سر أو بيانات أو صور. الأسرار تُضاف **فقط**
> في لوحة Cloudflare (Encrypted) وفي GitHub Secrets. والملفات تُخزَّن في Google Drive.
> يُنصح بجعل المستودع **Private**.

---

## 1) تثبيت الأدوات
```cmd
node -v
npm -v
git --version
```
(ثبّت Node LTS من https://nodejs.org وGit من https://git-scm.com إن لزم.) ثم:
```cmd
npm install -g wrangler
```

## 2) رفع المشروع على GitHub
فُك الضغط في `C:\school-platform` وأنشئ مستودعًا فارغًا باسم `schbns` (Private) ثم:
```cmd
cd C:\school-platform
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/schbns.git
git push -u origin main --force
```
✅ يجب أن ترى مجلدات `.github` و`functions` و`server` و`migrations` و`frontend`.

## 3) قاعدة بيانات D1
```cmd
cd C:\school-platform
npm install
npx wrangler login
npx wrangler d1 create school_platform_db
```
انسخ `database_id` الظاهر. افتح `wrangler.toml` واستبدل `00000000-0000-0000-0000-000000000000` به
**(للتطوير المحلي فقط — لا ترفع المعرف إلى GitHub؛ إن أردت: `git update-index --assume-unchanged wrangler.toml`)**. ثم:
```cmd
npx wrangler d1 migrations apply school_platform_db --remote
npx wrangler d1 execute school_platform_db --remote --command "SELECT username FROM users"
```
✅ يظهر مستخدم واحد `admin`.

---

## 4) إعداد Google Apps Script (تخزين الملفات + الشهادات + البريد)

### 5.1) أنشئ مجلد Google Drive
1. افتح https://drive.google.com
2. **جديد** → **مجلد** → سمِّه `School Platform`
3. افتح المجلد، وانسخ المعرّف من رابط المتصفح (الجزء الأخير بعد آخر `/`):
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt
                                            └────── هذا هو المعرّف ──────┘
   ```
   احتفظ به باسم **`ROOT_FOLDER_ID`**.

### 5.2) أنشئ قالب الشهادة (Google Docs)
1. **داخل نفس المجلد** أنشئ مستند Google Docs جديد، سمِّه `Certificate Template`.
2. صمِّم شكل الشهادة (شعار، حدود، تنسيق)، وضع بالضبط هذه العبارات في أماكنها
   (ستُستبدل تلقائيًا ببيانات كل طالب):
   ```
   {{student_name}}   {{student_code}}   {{academic_year}}   {{term}}
   {{total_score}}    {{percentage}}     {{grade}}           {{verification_code}}
   {{subjects_table}}
   ```
3. انسخ المعرّف من رابط المستند (بين `/d/` و`/edit`):
   ```
   https://docs.google.com/document/d/1XyZaBcDeFgHiJkLmNoPqRsT/edit
                                       └────── هذا هو المعرّف ──────┘
   ```
   احتفظ به باسم **`CERT_TEMPLATE_DOC_ID`**.

### 5.3) أنشئ مشروع Apps Script
1. افتح https://script.google.com → **مشروع جديد**.
2. احذف أي كود موجود في المحرر.
3. افتح ملف `gas\Code.gs` من مشروعك (بأي محرر نصوص)، انسخ **كل** محتواه،
   والصقه في محرر Apps Script.
4. غيّر اسم المشروع أعلى الصفحة إلى `School Platform Backend`.

### 5.4) أضف الإعدادات السرّية (Script Properties)
1. من القائمة الجانبية اضغط أيقونة **⚙️ Project Settings**.
2. انزل لقسم **Script Properties** → **Add script property**.
3. أضف **3 أسطر منفصلة بالضبط** (كل سطر بزر "Add script property" خاص به):

| العمود الأول Property | العمود الثاني Value |
|---|---|
| `API_SECRET` | كلمة سر تختارها أنت بنفسك، أي نص عشوائي طويل مثل `Sc7kL9pQ2xR5vM8wZ` |
| `ROOT_FOLDER_ID` | المعرّف **الفعلي** من الخطوة 5.1 (وليس اسم "ROOT_FOLDER_ID" نفسه) |
| `CERT_TEMPLATE_DOC_ID` | المعرّف **الفعلي** من الخطوة 5.2 (وليس اسم "CERT_TEMPLATE_DOC_ID" نفسه) |

⚠️ **الخطأ الأكثر شيوعًا**: وضع اسم الخاصية في خانة Value بالخطأ. تأكد أن
عمود Value يحتوي دائمًا القيمة الحقيقية (سلسلة أحرف/أرقام)، وليس نص اسم آخر.

4. اضغط **Save script properties**.

### 5.5) انشر المشروع كـ Web App
1. من القائمة الجانبية: **Deploy** → **New deployment**.
2. بجانب "Select type" اضغط أيقونة الترس ⚙️ → اختر **Web app**.
3. **Execute as**: `Me` (بريدك).
4. **Who has access**: `Anyone`.
5. اضغط **Deploy**.
6. عند ظهور "Authorize access": اضغط **Authorize access** → اختر حسابك →
   إن ظهر "Google hasn't verified this app" اضغط **Advanced** ثم
   **Go to School Platform Backend (unsafe)** ثم **Allow**.
   (هذا طبيعي تمامًا؛ الكود ملكك أنت فقط ولم يُنشر في متجر عام).
7. **انسخ رابط "Web app URL"** الظاهر — احتفظ به باسم **`GAS_WEBAPP_URL`**.

### 5.6) فعِّل صلاحية إرسال البريد (مرة واحدة)
1. في محرر Apps Script، من القائمة المنسدلة أعلى المحرر اختر الدالة `sendEmail`.
2. اضغط **▶ Run**.
3. ستظهر نفس نافذة التفويض؛ وافق كما في الخطوة السابقة.

📝 الآن لديك:
```
GAS_WEBAPP_URL = https://script.google.com/macros/s/XXXXX/exec
GAS_API_SECRET = (نفس قيمة API_SECRET التي اخترتها في 5.4)
```

---

---

## 5) أسرار الإنتاج (لوحة Cloudflare — وليس في الكود)
Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (الخطوة 6 أدناه) ثم من مشروعك:
**Settings → Variables and Secrets → Add** (اختر النوع **Secret/Encrypted**):

| الاسم | القيمة |
|---|---|
| `JWT_SECRET` | نص عشوائي طويل: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **احفظه في مكان آمن؛ فقدانه يعني فقدان قراءة الأرقام القومية** |
| `GAS_WEBAPP_URL` | رابط Web App من الخطوة 4 |
| `GAS_API_SECRET` | نفس قيمة `API_SECRET` في Script Properties |

ثم **Settings → Bindings → Add → D1 database**: الاسم `DB` ← اختر `school_platform_db`.
(أضِف المتغيرات والـ Binding لبيئة **Production**.)

## 6) ربط Pages بالمستودع (الخطوة اليدوية الأخيرة)
**Create → Pages → Connect to Git** → اختر `schbns` → الإعدادات:

| الحقل | القيمة |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | **اتركه فارغًا** (مهم: مجلد `functions` في جذر المستودع) |

اضغط **Save and Deploy**. اسم المشروع `schbns` ← `https://schbns.pages.dev`.
**لا تضف `VITE_API_BASE`** — الـ API على نفس النطاق (`/api`).
بعد إضافة الأسرار/الـ Binding، نفّذ **Deployments → Retry deployment** ليلتقطها.

## 7) أسرار GitHub Actions
GitHub → المستودع → **Settings → Secrets and variables → Actions**:
`CLOUDFLARE_API_TOKEN` (قالب Edit Cloudflare Workers + صلاحية D1 Edit)، `CLOUDFLARE_ACCOUNT_ID`، `D1_DATABASE_ID`،
`GAS_WEBAPP_URL`، `GAS_API_SECRET`. الـ workflow الأول يطبّق migrations الجديدة تلقائيًا، والثاني نسخ احتياطي يومي إلى Drive.

## 8) التحقق النهائي
1. افتح `https://schbns.pages.dev/api/health` ← `{"status":"ok"...}`.
2. سجّل الدخول بـ `admin` (كلمة المرور المؤقتة تُسلَّم لك خارج المستودع) وغيّرها فورًا.
3. افتح `/admin/analytics` (للمدير العام فقط) لإحصائيات الزوار.
4. جرّب استيراد طالب برقم قومي ثم افحص D1: العمود يبدأ بـ `v1:` (مشفّر).

## استكشاف الأخطاء
| العَرَض | السبب | الحل |
|---|---|---|
| `/api/...` يعيد 404/HTML | Root directory ليس فارغًا أو `functions` غير مرفوع | اجعله فارغًا وتأكد من وجود `functions/api/[[route]].ts` |
| تسجيل الدخول: "حدث خطأ غير متوقع" | Binding `DB` ناقص أو migrations غير مطبّقة أو `JWT_SECRET` ناقص | الخطوتان 3 و5 ثم Retry deployment؛ راجع Functions logs في لوحة Pages |
| `no such table` | لم تُطبَّق migrations | `npx wrangler d1 migrations apply school_platform_db --remote` |
| رفع ملف يفشل | نوع/حجم غير مسموح (PNG/JPG/WEBP/PDF حتى 2MB) أو أسرار GAS خاطئة | راجع الخطوة 4 و5 |
| 429 عند الدخول | تجاوز حد المحاولات | انتظر 10 دقائق |
| `ENCRYPTION_KEY_MISSING` عند الاستيراد | المفتاح غير مضبوط | الخطوة 5 |

## التطوير المحلي (اختياري)
```cmd
copy .dev.vars.example .dev.vars
npm run build
npx wrangler d1 migrations apply school_platform_db --local
npm run dev
```
