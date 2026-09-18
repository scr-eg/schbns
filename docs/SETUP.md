# دليل التنفيذ والنشر المبسَّط — من الصفر حتى موقع يعمل بالكامل

اتبع الخطوات **بالترتيب تمامًا**. كل خطوة مبنية على التي قبلها. استخدم
Command Prompt (`cmd`) على Windows — نفس الأوامر تعمل في PowerShell أو
Terminal (Mac/Linux) بلا أي تغيير.

⏱️ الوقت المتوقع: 45-60 دقيقة أول مرة.

---

## نظرة عامة سريعة (لماذا هذا الترتيب)

الموقع = جزءان منفصلان يعملان معًا، ولا غنى عن أحدهما:
- **الواجهة (الموقع الذي يراه الناس)** → تُنشر بربط لوحي بسيط بين Cloudflare وGitHub، **بدون أي أوامر**.
- **الخادم (تسجيل الدخول، قاعدة البيانات، كل الوظائف)** → يتطلب أوامر Terminal حتمًا (لا بديل).

```
1) تثبيت الأدوات
2) حساب Cloudflare (API Token + Account ID)
3) رفع المشروع على GitHub
4) قاعدة بيانات D1 (Terminal)
5) Google Apps Script (تخزين الملفات + الشهادات + البريد)
6) أسرار الخادم (Terminal)
7) نشر الخادم (Terminal)
8) ربط الواجهة بـ Cloudflare Pages (لوحة فقط)
9) أسرار GitHub Actions
10) أول نشر تلقائي
11) تسجيل الدخول والتحقق
```

---

## 1) تثبيت الأدوات (مرة واحدة فقط)

افتح `cmd` ونفّذ كل أمر على حدة، تأكد من ظهور رقم إصدار (لا رسالة خطأ):

```cmd
node -v
npm -v
git --version
```

- لم يعمل `node`؟ ثبّت من https://nodejs.org (اختر نسخة **LTS**).
- لم يعمل `git`؟ ثبّت من https://git-scm.com

ثم:
```cmd
npm install -g wrangler
wrangler --version
```

---

## 2) حساب Cloudflare

1. أنشئ حسابًا مجانيًا: https://dash.cloudflare.com/sign-up (وفعّله من بريدك).
2. **احصل على Account ID**: بعد الدخول، من القائمة الجانبية اضغط
   **Workers & Pages** — سيظهر "Account ID" في الشريط الجانبي الأيمن. انسخه.
3. **أنشئ API Token**:
   - اذهب إلى https://dash.cloudflare.com/profile/api-tokens
   - **Create Token** → قالب **"Edit Cloudflare Workers"** → **Use template**
   - **Continue to summary** → **Create Token**
   - انسخ التوكن فورًا (لن يظهر مرة ثانية)
4. من `cmd`:
```cmd
wrangler login
```
سيفتح المتصفح — اضغط **Allow**.

📝 احتفظ في ملف نصي بجانبك بهاتين القيمتين، ستحتاجهما كثيرًا:
```
CLOUDFLARE_ACCOUNT_ID = ...
CLOUDFLARE_API_TOKEN  = ...
```

---

## 3) رفع المشروع على GitHub

1. فُك ضغط `school-platform.zip` في مجلد على جهازك (مثلًا `C:\school-platform`).
2. أنشئ مستودعًا **جديدًا وفارغًا تمامًا** (لا تضف README): https://github.com/new
   سمِّه `schbns`.
3. من `cmd` داخل مجلد المشروع:
```cmd
cd C:\school-platform
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/schbns.git
git push -u origin main
```
(استبدل `USERNAME` باسمك على GitHub. إن رفعت المستودع يدويًا من قبل وبه
ملفات ناقصة، أضف `--force` في نهاية آخر أمر لاستبداله بالكامل.)

✅ **تحقق الآن**: افتح صفحة المستودع على GitHub، ويجب أن ترى مجلد `.github`
ظاهرًا ضمن القائمة (وليس فقط `docs`, `frontend`, `worker`). إن لم يظهر، لم
يكتمل الرفع بشكل صحيح.

---

## 4) قاعدة بيانات D1 (Terminal)

```cmd
cd worker
npm install
npx wrangler d1 create school_platform_db
```

سيطبع الأمر كتلة نصية تحتوي `database_id = "..."`. **افتح ملف
`worker\wrangler.toml`** بأي محرر نصوص (Notepad كافٍ)، وابحث عن السطر:
```toml
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```
واستبدل القيمة بالمعرّف الحقيقي الذي ظهر لك، ثم احفظ الملف.

طبّق الجداول (أمران، محلي ثم فعلي):
```cmd
npx wrangler d1 migrations apply school_platform_db --local
npx wrangler d1 migrations apply school_platform_db --remote
```

✅ **تحقق الآن**:
```cmd
npx wrangler d1 execute school_platform_db --remote --command "SELECT username FROM users"
```
يجب أن يظهر مستخدم واحد اسمه `admin`. إن ظهر خطأ `no such table`، أعد تنفيذ
أمر `--remote` أعلاه.

---

## 5) إعداد Google Apps Script (تخزين الملفات + الشهادات + البريد)

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

## 6) أسرار الخادم (Terminal)

ولِّد `JWT_SECRET` عشوائي (أمر واحد يعمل على أي جهاز):
```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
انسخ الناتج، ثم من داخل مجلد `worker`:

```cmd
npx wrangler secret put JWT_SECRET
```
(الصق القيمة التي ولّدتها عند الطلب، ثم Enter)

```cmd
npx wrangler secret put GAS_WEBAPP_URL
```
(الصق رابط Web App من الخطوة 5.5)

```cmd
npx wrangler secret put GAS_API_SECRET
```
(الصق قيمة API_SECRET من الخطوة 5.4)

✅ **تحقق الآن**:
```cmd
npx wrangler secret list
```
يجب أن تظهر 3 أسماء بالضبط: `JWT_SECRET`, `GAS_WEBAPP_URL`, `GAS_API_SECRET`.

---

## 7) نشر الخادم (Terminal)

```cmd
npx wrangler deploy
```
سيظهر رابط مثل:
```
https://schbns-api.YOUR-SUBDOMAIN.workers.dev
```
📝 احتفظ به.

✅ **تحقق الآن**: افتح في المتصفح:
```
https://schbns-api.YOUR-SUBDOMAIN.workers.dev/api/health
```
يجب أن تظهر: `{"status":"ok","env":"production"}`

**إن لم تظهر هذه النتيجة، توقف هنا ولا تكمل** — أرسل لي رسالة الخطأ بالضبط.

---

## 8) ربط الواجهة بـ Cloudflare Pages (لوحة التحكم فقط، بدون أي أمر)

1. من https://dash.cloudflare.com اذهب لـ **Workers & Pages**.
2. **Create application** → تبويب **Pages** → **Connect to Git**.
3. اختر GitHub ووافق على الصلاحيات، ثم اختر مستودع `schbns`.
4. املأ الحقول **بالضبط** كالتالي (لا تترك أي قيمة افتراضية):

| الحقل | القيمة الصحيحة |
|---|---|
| Project name | `schbns` |
| Production branch | `main` |
| Framework preset | `Vite` (أو `None` إن لم يظهر Vite) |
| Build command | `npm run build` |
| **Build output directory** | **`dist`** ⚠️ (ليست `public`) |
| **Root directory (Advanced)** | **`frontend`** ⚠️ (الأهم — المشروع فيه أكثر من مجلد) |

5. اضغط **Environment variables (Advanced)** → **Add variable**:

| Variable name | Value |
|---|---|
| `VITE_API_BASE` | رابط الخادم من الخطوة 7 + `/api`، مثال: `https://schbns-api.YOUR-SUBDOMAIN.workers.dev/api` |

6. اضغط **Save and Deploy** وانتظر دقيقة أو دقيقتين.
7. رابط موقعك أصبح: **`https://schbns.pages.dev`**

من الآن، أي تعديل تدفعه لـ `main` يُعاد بناؤه ونشره تلقائيًا بلا أي تدخل.

---

## 9) أسرار GitHub Actions (لتحديث الخادم تلقائيًا مستقبلًا)

على GitHub: مستودعك → **Settings** → **Secrets and variables** → **Actions**
→ **New repository secret** لكل سطر:

| الاسم | القيمة |
|---|---|
| `CLOUDFLARE_API_TOKEN` | من الخطوة 2 |
| `CLOUDFLARE_ACCOUNT_ID` | من الخطوة 2 |
| `GAS_WEBAPP_URL` | من الخطوة 5.5 |
| `GAS_API_SECRET` | من الخطوة 5.4 |

---

## 10) أول نشر تلقائي كامل

```cmd
git add .
git commit -m "Update"
git push
```
- **Cloudflare Pages** يبني وينشر الواجهة تلقائيًا (راقبه من لوحة Cloudflare → Pages → مشروعك → Deployments).
- **GitHub Actions** ينشر الخادم تلقائيًا فقط إذا عدّلت شيئًا داخل مجلد `worker` (راقبه من تبويب Actions على GitHub).

---

## 11) التحقق النهائي — الخطوة الأهم

1. افتح `https://schbns.pages.dev`
2. اضغط **تسجيل الدخول**
3. اسم المستخدم: `admin` — كلمة المرور: `dz74Gbgp@nWWQNQz`
4. **غيّر كلمة المرور فورًا** من داخل النظام (لأنها موثَّقة هنا ومعروفة).
5. نجح الدخول ورأيت لوحة التحكم؟ **مبروك، النظام يعمل بالكامل فعليًا.**

---

## استكشاف الأخطاء الشائعة

| المشكلة | السبب | الحل |
|---|---|---|
| الموقع يظهر فارغًا/404 بعد نشر Pages | Root directory ليس `frontend` | Pages → مشروعك → Settings → Builds → عدّله لـ `frontend` |
| فشل بناء Pages: "no such file dist" | Build output directory = `public` بدل `dist` | عدّله من نفس الإعدادات |
| "حدث خطأ غير متوقع" عند الدخول | الجداول غير مطبَّقة على D1 الفعلية، أو الأسرار ناقصة | أعد الخطوة 4 (`--remote`) ثم تحقق من الخطوة 6 |
| خطأ CORS في المتصفح | `FRONTEND_ORIGIN` في `wrangler.toml` لا يطابق رابط Pages | عدّله لـ `https://schbns.pages.dev` ثم `npx wrangler deploy` |
| `GAS_ERROR: UNAUTHORIZED` | `GAS_API_SECRET` لا يطابق `API_SECRET` في Script Properties | تأكد من التطابق الحرفي تمامًا |
| إصدار شهادة يفشل `PDF_GENERATION_FAILED` | معرّف القالب أو المجلد خاطئ في Script Properties | راجع الخطوة 5.4 وتأكد أن القيم فعلية وليست أسماء متغيرات |
| نسيت كلمة المرور لا يصل بريده | لم تُنفَّذ الخطوة 5.6 | نفّذها الآن يدويًا |

---

## الخطوات التالية بعد نجاح كل شيء

راجع `docs/INITIAL_ADMIN.md` لإنشاء حسابات حقيقية لموظفي مدرستك، و
`docs/TESTING_CHECKLIST.md` لاختبار شامل قبل الاستخدام الفعلي.
