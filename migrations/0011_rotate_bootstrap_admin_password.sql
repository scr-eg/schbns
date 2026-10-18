-- تدوير كلمة مرور الحساب الإداري الأولي: كلمة المرور القديمة كانت منشورة في مستودع عام.
-- يُطبَّق فقط إن لم يغيّر المستخدم كلمة المرور بعد (الـ hash لا يزال هو الأصلي).
UPDATE users
SET password_hash = '$2a$10$i49yQgXCSnlX3igyMBv.OOeUCJ8.kI3ALj1ibHs2v0FilYR33xi.K'
WHERE id = 'user-bootstrap-admin'
  AND password_hash = '$2b$10$Hx62wOTq4E3vvOJ9bQTnvuB98FcfNf7uCrmtf4sNZC.rixTP2HTpG';
