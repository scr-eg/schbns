# معمارية منصة المدرسة

## 1. نظرة عامة

```
                         ┌─────────────────────────┐
                         │   المستخدم (متصفح)        │
                         │  RTL عربي / LTR إنجليزي    │
                         └────────────┬────────────┘
                                      │ HTTPS
                         ┌────────────▼────────────┐
                         │  Cloudflare Pages         │
                         │  (React + Vite SPA)       │
                         └────────────┬────────────┘
                                      │ fetch() /api/*
                         ┌────────────▼────────────┐
                         │  Cloudflare Worker         │
                         │  (Hono + Drizzle ORM)      │
                         │  - Auth (JWT)              │
                         │  - RBAC Middleware         │
                         │  - Business Logic          │
                         │  - Validation (Zod)        │
                         └───────┬────────────┬──────┘
                                 │            │
                    ┌────────────▼───┐   ┌────▼─────────────────┐
                    │  Cloudflare D1   │   │  Google Apps Script    │
                    │  (SQLite)        │   │  Web App (بديل R2)      │
                    │  كل البيانات     │   │  - رفع/جلب الملفات      │
                    │  المُهيكلة        │   │  - توليد PDF (شهادات)   │
                    └──────────────────┘   │  - نسخ احتياطي إضافي   │
                                            └────────┬───────────────┘
                                                     │
                                          ┌──────────▼──────────┐
                                          │   Google Drive        │
                                          │  (تخزين الملفات فعليًا) │
                                          └────────────────────────┘
```

## 2. مبدأ الأمان الأساسي

كل التحقق من الصلاحيات (RBAC) يتم **داخل الـ Worker** على مستوى كل Endpoint،
وليس فقط بإخفاء عناصر الواجهة. أي طلب من مستخدم لا يملك الصلاحية المطلوبة
يُرفض بـ `403 Forbidden` ويُسجَّل في جدول `audit_logs`.

## 2.1 ملاحظة عن طبقة الوصول لقاعدة البيانات

`worker/src/db/schema.ts` يحتوي مخطط Drizzle ORM الكامل (39 جدولًا، مطابق 100%
لـ `migrations/*.sql`) كمرجع رسمي لشكل البيانات وأنواعها. عمليًا، كل الـ Routes
الحالية تستخدم SQL خام مباشرة عبر `c.env.DB.prepare(...)` بدل Drizzle Query
Builder — قرار مقصود لتفادي أي Overhead إضافي في بيئة Edge حساسة لزمن
الاستجابة، ولإتاحة تحكم صريح بالفهارس والاستعلامات المركّبة (JOINs متعددة).
يمكن لأي مطوّر لاحق استخدام `drizzle(env.DB)` مع هذا المخطط مباشرة في أي
Route جديد يُفضَّل فيه الأمان النوعي الكامل؛ كلا الأسلوبين آمنان على نفس القاعدة.

## 3. تدفق المصادقة (Auth Flow)

1. المستخدم يرسل `username/email + password` إلى `POST /api/auth/login`.
2. الـ Worker يتحقق من كلمة المرور (Argon2/bcrypt WASM متوافق مع Workers).
3. عند النجاح: يُصدر JWT (صلاحية قصيرة ~15 دقيقة) + Refresh Token (يُخزَّن كـ HttpOnly Cookie).
4. كل طلب لاحق يمر عبر `authMiddleware` الذي يفك تشفير JWT ويحقن `user` + `role` + `permissions` في الـ Context.
5. `rbacMiddleware(requiredPermission)` يتحقق من الصلاحية قبل تنفيذ أي Route.
6. تسجيل الخروج يُبطل الـ Refresh Token من جدول `sessions`.

## 4. طبقة التخزين البديلة (GAS بدل R2)

- الـ Worker لا يخزن ملفات إطلاقًا؛ فقط يستدعي GAS Web App عبر `fetch()` مع
  رأس `X-API-SECRET` (سر مشترك محفوظ في Cloudflare Secrets وفي GAS Script Properties).
- الاستجابة من GAS تحتوي `driveFileId` و `viewUrl`، تُخزَّن في جدول `files` بربط Polymorphic
  (`entity_type`, `entity_id`) مع أي كيان (طالب، شهادة، إعلان، شعار المدرسة...).
- توليد PDF للشهادات: الـ Worker يرسل بيانات الطالب/النتيجة إلى GAS، الذي ينسخ
  قالب Google Docs، يستبدل الحقول (`{{student_name}}`, `{{grade}}`...)، يصدّره PDF،
  يرفعه لمجلد `Certificates`، ويعيد الرابط + يُنشئ رمز تحقق فريد (QR).

## 5. سير عمل الامتحانات والنتائج (ملخّص - التفاصيل في EXAM_WORKFLOW.md)

```
Draft → Submitted → Reviewed → Approved → Published → Locked
```

كل انتقال بين الحالات مقيّد بدور محدد (المعلم يدخل Draft/Submitted فقط،
الكنترول يراجع ويعتمد، لا تعديل بعد Locked إلا بصلاحية استثنائية موثّقة بالكامل).

## 6. تعدد السنوات الدراسية

كل جدول بيانات طلابية يحمل `academic_year_id` إلزاميًا. لا حذف فعلي لأي
نتيجة معتمدة سابقًا؛ الأرشفة منطقية وليست بالحذف.

## 7. النشر (CI/CD)

`GitHub Actions` عند كل `push` إلى `main`:
1. تثبيت الاعتماديات وبناء الفرونت (`frontend/dist`).
2. نشر الفرونت إلى Cloudflare Pages.
3. تطبيق أي migrations جديدة على D1 (`wrangler d1 migrations apply`).
4. نشر الـ Worker (`wrangler deploy`).

جميع الأسرار (`JWT_SECRET`, `GAS_API_SECRET`, `GAS_WEBAPP_URL`, `CF_API_TOKEN`)
تُحفظ في GitHub Secrets و Cloudflare Secrets، ولا تظهر أبدًا داخل الكود.
