/**
 * Google Apps Script — بديل مجاني لـ Cloudflare R2
 * ------------------------------------------------
 * يُنشر كـ Web App:
 *   Deploy > New deployment > Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone (يُحمى بالسر المشترك API_SECRET وليس بصلاحيات Drive)
 *
 * الإعداد المطلوب قبل النشر:
 *   1) File > Project properties > Script properties، أضف:
 *        API_SECRET   = <سر عشوائي طويل، نفسه في Cloudflare Worker Secrets>
 *        ROOT_FOLDER_ID = <معرّف مجلد Drive الرئيسي للمدرسة>
 *        CERT_TEMPLATE_DOC_ID = <معرّف قالب Google Docs لشهادة النتيجة>
 *   2) بعد النشر، انسخ رابط Web App وضعه في Worker Secret باسم GAS_WEBAPP_URL.
 */

function doPost(e) {
  return handleRequest(e);
}
function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("API_SECRET");
    const providedSecret = (e.parameter && e.parameter.secret) ||
      (e.postData && JSON.parse(e.postData.contents || "{}").secret);

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const action = e.parameter.action;
    const payload = e.postData ? JSON.parse(e.postData.contents || "{}") : {};

    switch (action) {
      case "upload":
        return jsonResponse(uploadFile(payload));
      case "fetch":
        return jsonResponse(fetchFileMeta(e.parameter.id));
      case "delete":
        return jsonResponse(deleteFile(payload.id || e.parameter.id));
      case "generatePDF":
        return jsonResponse(generateCertificatePDF(payload));
      case "sendEmail":
        return jsonResponse(sendEmail(payload));
      case "backup":
        return jsonResponse(storeBackup(payload));
      default:
        return jsonResponse({ error: "UNKNOWN_ACTION" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: "SERVER_ERROR", message: String(err) }, 500);
  }
}

/** رفع ملف (base64) إلى مجلد فرعي محدد داخل مجلد المدرسة الرئيسي */
function uploadFile(payload) {
  const { fileName, base64Data, mimeType, subFolder } = payload;
  if (!fileName || !base64Data) throw new Error("fileName و base64Data مطلوبان");

  const rootFolder = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty("ROOT_FOLDER_ID")
  );
  const folder = getOrCreateSubFolder(rootFolder, subFolder || "Misc");

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType || "application/octet-stream", fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    driveFileId: file.getId(),
    viewUrl: file.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId(),
  };
}

function fetchFileMeta(fileId) {
  const file = DriveApp.getFileById(fileId);
  return {
    driveFileId: file.getId(),
    name: file.getName(),
    viewUrl: file.getUrl(),
    mimeType: file.getMimeType(),
  };
}

function deleteFile(fileId) {
  DriveApp.getFileById(fileId).setTrashed(true);
  return { success: true };
}

/** توليد شهادة PDF من قالب Google Docs باستبدال Placeholders */
function generateCertificatePDF(payload) {
  const { studentName, studentCode, academicYear, term, subjects, totalScore, percentage, grade, verificationCode } = payload;

  const templateId = PropertiesService.getScriptProperties().getProperty("CERT_TEMPLATE_DOC_ID");
  const rootFolder = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty("ROOT_FOLDER_ID")
  );
  const certFolder = getOrCreateSubFolder(rootFolder, "Certificates");

  const copy = DriveApp.getFileById(templateId).makeCopy(
    `Certificate_${studentCode}_${verificationCode}`,
    certFolder
  );
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  body.replaceText("{{student_name}}", studentName || "");
  body.replaceText("{{student_code}}", studentCode || "");
  body.replaceText("{{academic_year}}", academicYear || "");
  body.replaceText("{{term}}", term || "");
  body.replaceText("{{total_score}}", String(totalScore ?? ""));
  body.replaceText("{{percentage}}", String(percentage ?? ""));
  body.replaceText("{{grade}}", grade || "");
  body.replaceText("{{verification_code}}", verificationCode || "");

  if (Array.isArray(subjects)) {
    const subjectsText = subjects.map((s) => `${s.name}: ${s.score}`).join("\n");
    body.replaceText("{{subjects_table}}", subjectsText);
  }

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(copy.getId()).getAs("application/pdf");
  const pdfFile = certFolder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // حذف نسخة Google Docs المؤقتة، الاحتفاظ بالـ PDF فقط
  DriveApp.getFileById(copy.getId()).setTrashed(true);

  return {
    driveFileId: pdfFile.getId(),
    viewUrl: pdfFile.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + pdfFile.getId(),
  };
}

/** استقبال نسخة احتياطية (تصدير D1 كـ SQL/JSON) وتخزينها في Drive */
function storeBackup(payload) {
  const { fileName, base64Data } = payload;
  const rootFolder = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty("ROOT_FOLDER_ID")
  );
  const backupFolder = getOrCreateSubFolder(rootFolder, "Backups");
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, "application/sql", fileName);
  const file = backupFolder.createFile(blob);
  return { driveFileId: file.getId(), viewUrl: file.getUrl() };
}

/** إرسال بريد إلكتروني عبر Gmail المرتبط بحساب Google (مجاني، بديل عن SMTP خارجي) */
function sendEmail(payload) {
  const { to, subject, body } = payload;
  if (!to || !subject || !body) throw new Error("to, subject, body مطلوبة");
  GmailApp.sendEmail(to, subject, body);
  return { success: true };
}

function getOrCreateSubFolder(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function jsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output; // ملاحظة: Apps Script Web Apps لا تدعم HTTP status code مخصص فعليًا،
                 // لذا يجب على الـ Worker فحص وجود "error" في الـ body بدل الاعتماد على status.
}
