# ERD — مخطط قاعدة البيانات (Cloudflare D1 / SQLite)

> ملاحظة: SQLite لا يدعم ENUM حقيقي، لذا تُستخدم `TEXT` مع `CHECK` constraints.
> كل الجداول تحمل `id TEXT PRIMARY KEY` (UUID) ما لم يُذكر غير ذلك،
> بالإضافة إلى `created_at`, `updated_at` (تلقائية).

```mermaid
erDiagram
    USERS ||--o{ AUDIT_LOGS : "يسجل"
    USERS }o--|| ROLES : "له"
    ROLES ||--o{ ROLE_PERMISSIONS : "يملك"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "تُمنح"

    ACADEMIC_YEARS ||--o{ TERMS : "تحتوي"
    ACADEMIC_YEARS ||--o{ STUDENT_CLASSES : "لسنة"
    STAGES ||--o{ GRADES : "تضم"
    GRADES ||--o{ CLASSES : "تضم"
    CLASSES ||--o{ SECTIONS : "تنقسم"

    STUDENTS ||--o{ STUDENT_CLASSES : "يلتحق"
    STUDENTS ||--o{ PARENT_STUDENT : "يرتبط"
    PARENTS ||--o{ PARENT_STUDENT : "يرتبط"

    TEACHERS ||--o{ TEACHER_SUBJECTS : "يدرّس"
    SUBJECTS ||--o{ TEACHER_SUBJECTS : "تُدرَّس"
    SUBJECTS ||--o{ GRADE_COMPONENTS : "لها مكوّنات درجات"

    SECTIONS ||--o{ TIMETABLES : "لها جدول"
    SECTIONS ||--o{ ATTENDANCE : "حضور"
    STUDENTS ||--o{ ATTENDANCE : "له سجل"

    ACADEMIC_YEARS ||--o{ EXAMS : "امتحانات"
    TERMS ||--o{ EXAMS : "امتحانات"
    EXAM_TYPES ||--o{ EXAMS : "نوع"
    EXAMS ||--o{ EXAM_SUBJECTS : "مواد"
    EXAMS ||--o{ EXAM_COMMITTEES : "لجان"
    EXAMS ||--o{ SEATING_NUMBERS : "جلوس"
    STUDENTS ||--o{ SEATING_NUMBERS : "رقم جلوس"

    EXAM_SUBJECTS ||--o{ EXAM_RESULTS : "نتائج"
    STUDENTS ||--o{ EXAM_RESULTS : "نتيجة طالب"
    EXAM_RESULTS ||--o{ RESULT_DETAILS : "تفاصيل مكوّنات"
    EXAM_RESULTS ||--o{ RESULT_APPROVALS : "دورة اعتماد"

    STUDENTS ||--o{ CERTIFICATES : "شهادات"
    FILES }o--|| STUDENTS : "polymorphic"

    USERS {
        text id PK
        text username
        text email
        text password_hash
        text role_id FK
        text status
        text last_login_at
    }

    STUDENTS {
        text id PK
        text student_code
        text full_name
        text national_id_encrypted
        text birth_date
        text gender
        text status
        text current_stage_id FK
        text photo_file_id
    }

    EXAM_RESULTS {
        text id PK
        text student_id FK
        text exam_subject_id FK
        real total_score
        real percentage
        text grade_letter
        text status
        text workflow_state
    }

    RESULT_APPROVALS {
        text id PK
        text exam_result_id FK
        text from_state
        text to_state
        text acted_by FK
        text reason
        text created_at
    }

    AUDIT_LOGS {
        text id PK
        text user_id FK
        text action
        text entity_type
        text entity_id
        text old_value
        text new_value
        text reason
        text created_at
    }
```

## الجداول الكاملة (قائمة مرجعية)

```
users, roles, permissions, role_permissions, sessions,
academic_years, terms, stages, grades, classes, sections,
subjects, student_classes, teacher_subjects,
students, parents, parent_student, teachers, staff,
timetables, attendance,
exam_types, exams, exam_subjects, exam_committees, seating_numbers,
grade_components, exam_results, result_details, result_approvals,
certificates, files,
announcements, notifications, messages, activities,
school_settings, audit_logs, backup_logs
```

راجع `worker/migrations/0001_init.sql` للتعريف الكامل بأنواع الأعمدة والقيود.
