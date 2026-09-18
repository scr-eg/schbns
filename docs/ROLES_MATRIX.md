# مصفوفة الأدوار والصلاحيات (RBAC)

| الوحدة | super_admin | school_admin | principal | vice_principal | exam_controller | teacher | student | parent | student_affairs | hr | accountant | activity_manager | counselor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| إعدادات النظام | CRUD | RU | R | - | - | - | - | - | - | - | - | - | - |
| المستخدمين والأدوار | CRUD | CRU | R | - | - | - | - | - | - | - | - | - | - |
| الطلاب | CRUD | CRUD | R | R | R | R (فصوله فقط) | R (نفسه) | R (أبناؤه) | CRU | - | R | - | R |
| المعلمين | CRUD | CRUD | R | R | - | R (نفسه) | - | - | - | CRUD | - | - | - |
| الجداول الدراسية | CRUD | CRUD | R | RU | R | R | R (فصله) | R (أبناؤه) | R | - | - | - | - |
| الحضور والغياب | CRUD | CRUD | R | R | - | CRU (فصوله) | R (نفسه) | R (أبناؤه) | R | - | - | - | R |
| إدخال الدرجات | - | R | R | R | R | CRU (مواده) | - | - | - | - | - | - | - |
| مراجعة/اعتماد النتائج | CRUD | R | R | RU | CRUD | R (بعد الاعتماد) | - | - | - | - | - | - | - |
| نشر النتائج | CRUD | R | RU | R | CRU | - | R (نفسه) | R (أبناؤه) | - | - | - | - | - |
| الشهادات | CRUD | CRUD | R | R | RU | - | R (نفسه) | R (أبناؤه) | - | - | - | - | - |
| التقارير | R | R | R | R | R (امتحانات فقط) | R (محدود) | - | - | R | R | R | - | - |
| الأخبار/الإعلانات | CRUD | CRUD | RU | RU | - | R | R | R | - | - | - | R | - |
| الأنشطة | CRUD | CRUD | R | R | - | R | R | R | - | - | - | CRUD | - |
| Audit Log | R (كامل) | R (كامل) | R | - | R (امتحانات) | - | - | - | - | - | - | - | - |
| النسخ الاحتياطي | CRUD | R | - | - | - | - | - | - | - | - | - | - | - |

**المفتاح:** C=Create, R=Read, U=Update, D=Delete, `-`=لا صلاحية.

> تُطبَّق هذه المصفوفة عبر جدول `role_permissions` القابل للتعديل من `super_admin`
> دون تعديل الكود، وتُفرض إلزاميًا داخل الـ Worker Middleware، وليس فقط في الواجهة.
