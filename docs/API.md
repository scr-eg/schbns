# توثيق الـ API

جميع المسارات تبدأ بـ `/api`. المصادقة عبر HttpOnly Cookies (`access_token`, `refresh_token`)
يضعها المتصفح تلقائيًا بعد تسجيل الدخول؛ لا حاجة لإرسال Authorization header يدويًا من الفرونت الرسمي.

## Auth (`/api/auth`)
| Method | Path | الوصف | صلاحية |
|---|---|---|---|
| POST | `/login` | تسجيل الدخول | عام |
| POST | `/logout` | تسجيل الخروج | مسجَّل دخوله |
| GET | `/me` | بيانات المستخدم الحالي | مسجَّل دخوله |
| POST | `/refresh` | تجديد access token | يملك refresh token صالح |
| POST | `/change-password` | تغيير كلمة المرور | مسجَّل دخوله |
| POST | `/forgot-password` | طلب رابط استعادة (عبر Gmail/GAS) | عام |
| POST | `/reset-password` | تعيين كلمة مرور جديدة بالرمز | عام (بالرمز الصحيح) |

## الطلاب (`/api/students`)
CRUD كامل + `GET /?q=&stageId=&status=` (فلاتر) + `GET /:id` (ملف كامل) + `POST /:id/enroll`.
صلاحية: `students.read`/`students.crud` (حسب العملية).

## المعلمون (`/api/teachers`)
CRUD كامل + `GET /me/subjects` (لحساب المعلم نفسه) + `POST /:id/assign` (تكليف بمادة/فصل).

## أولياء الأمور (`/api/parents`)
CRUD + `GET /my-children` (لحساب ولي الأمر نفسه) + `POST /:id/link-student` + `DELETE /:id/link-student/:studentId`.

## الهيكل الأكاديمي (`/api/academic`)
`GET/POST /stages`, `/grades`, `/classes`, `/sections`, `/subjects`, `/terms`, `/academic-years`.

## الاستيراد (`/api/import`)
`POST /students/validate` (معاينة وتحقق) ثم `POST /students/commit` (استيراد ذرّي عبر D1 batch).

## الجداول الدراسية (`/api/timetables`)
`GET /?sectionId=|teacherId=`, `POST /` (يمنع التعارض عبر UNIQUE constraints)، `DELETE /:id`.

## الحضور (`/api/attendance`)
`GET /roster?sectionId=&date=&periodIndex=`, `POST /bulk` (تسجيل جماعي)،
`GET /reports/student/:id`, `GET /reports/section/:id?month=`.

## الامتحانات (`/api/exams`)
`GET/POST /`, `GET /:id`, `PATCH /:id/status`, `POST /:id/subjects`, `POST /:id/committees`,
`POST /:id/seating/generate`, `GET /:id/seating`, `GET /mine/subjects` (لحساب المعلم).

## محرك الدرجات (`/api/grading`)
`GET/POST /components`, `DELETE /components/:id`, `GET/PUT /scale` (جدول التقديرات).

## النتائج (`/api/results`) — قلب الكنترول
| Method | Path | الوصف |
|---|---|---|
| POST | `/entry` | إدخال/تعديل درجة طالب (Draft فقط) |
| GET | `/exam-subject/:id` | قائمة نتائج مادة امتحان |
| GET | `/exam-subject/:id/entry-sheet` | كشف إدخال كامل (مكوّنات + طلاب + درجات) |
| POST | `/exam-subject/:id/submit` | Draft → Submitted (المعلم) |
| POST | `/exam-subject/:id/review` | Submitted → Reviewed (الكنترول) |
| POST | `/exam-subject/:id/approve` | Reviewed → Approved (يشغّل التحقق الكامل) |
| POST | `/exam-subject/:id/publish` | Approved → Published (ينشئ إشعارات) |
| POST | `/exam-subject/:id/lock` | Published → Locked |
| PATCH | `/:id/override` | تعديل استثنائي بعد القفل (super_admin، سبب إلزامي) |
| GET | `/student/:studentId` | نتائج طالب (منشور/مُقفل فقط لصاحبه) |

## الشهادات (`/api/certificates`)
`POST /issue` (يولّد PDF عبر GAS)، `GET /student/:studentId`، `GET /verify/:code` (عام، بلا تسجيل دخول).

## التقارير (`/api/reports`)
`GET /students`, `/attendance-summary`, `/exam-results-summary/:examId`, `/top-results/:examId`
— أضف `?format=csv` لتنزيل ملف Excel/CSV مباشرة.

## الإشعارات (`/api/notifications`)
`GET /`, `PATCH /:id/read`, `PATCH /read-all`, `POST /` (إشعار يدوي من الإدارة).

## البحث (`/api/search`)
`GET /?q=` يبحث في الطلاب/المعلمين/المواد/الإعلانات دفعة واحدة.

## سجل العمليات (`/api/audit-logs`)
`GET /?action=&entityType=&from=&to=` — للعرض فقط، لا يوجد DELETE/PATCH إطلاقًا على هذا المسار.

## النسخ الاحتياطي (`/api/backup`)
`GET /logs` — التنفيذ الفعلي مجدول عبر GitHub Actions (`.github/workflows/backup.yml`).

## الإعلانات والأنشطة والإعدادات والمستخدمين
راجع `routes/announcements.ts`, `routes/activities.ts`, `routes/settings.ts`, `routes/users.ts`.

---

## رموز الأخطاء الموحّدة
جميع الأخطاء تُرجع `{ error: "CODE", message: "نص عربي" }` مع HTTP status مناسب:
`400` تحقق فاشل، `401` غير مسجَّل دخوله، `403` ممنوع (ويُسجَّل في audit_logs)، `404` غير موجود،
`409` تعارض (مثال: كود مكرر أو تعارض جدول)، `500` خطأ خادم، `502` فشل استدعاء خارجي (GAS).
