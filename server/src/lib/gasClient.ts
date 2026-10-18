// worker/src/lib/gasClient.ts
// طبقة وسيطة للتواصل مع Google Apps Script (بديل R2)
import type { Env } from "../index";

interface GasResponse {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

async function callGas(env: Env, action: string, payload: Record<string, unknown>): Promise<GasResponse> {
  const res = await fetch(`${env.GAS_WEBAPP_URL}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, secret: env.GAS_API_SECRET }),
  });
  const data = (await res.json()) as GasResponse;
  if (data.error) {
    throw new Error(`GAS_ERROR: ${data.error} - ${data.message ?? ""}`);
  }
  return data;
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES: Record<string, { ext: string[]; magic: number[][] }> = {
  "image/png": { ext: ["png"], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/jpeg": { ext: ["jpg", "jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  "image/webp": { ext: ["webp"], magic: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { ext: ["pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] },
};

export class UploadValidationError extends Error {}

// يتحقق من النوع (قائمة بيضاء) والامتداد والحجم والتوقيع الفعلي للملف قبل أي رفع
export function validateUpload(params: { fileName: string; base64Data: string; mimeType: string }) {
  const rule = ALLOWED_TYPES[params.mimeType];
  if (!rule) throw new UploadValidationError("نوع الملف غير مسموح (المسموح: PNG, JPG, WEBP, PDF)");
  const ext = params.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!rule.ext.includes(ext)) throw new UploadValidationError("امتداد الملف لا يطابق نوعه");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(params.base64Data)) throw new UploadValidationError("محتوى الملف غير صالح");
  const size = Math.floor((params.base64Data.length * 3) / 4);
  if (size > MAX_UPLOAD_BYTES) throw new UploadValidationError("حجم الملف يتجاوز 2 ميجابايت");
  const head = atob(params.base64Data.slice(0, 16));
  const bytes = Array.from(head, (ch) => ch.charCodeAt(0));
  if (!rule.magic.some((m) => m.every((b, i) => bytes[i] === b))) {
    throw new UploadValidationError("محتوى الملف لا يطابق نوعه المعلن");
  }
}

export async function uploadFileToGas(
  env: Env,
  params: { fileName: string; base64Data: string; mimeType: string; subFolder: string }
) {
  validateUpload(params);
  const safeName = params.fileName.replace(/[^\w.\-\u0600-\u06FF ]/g, "_").slice(0, 100);
  return callGas(env, "upload", { ...params, fileName: safeName }) as Promise<{ driveFileId: string; viewUrl: string; downloadUrl: string }>;
}

export async function deleteFileFromGas(env: Env, fileId: string) {
  return callGas(env, "delete", { id: fileId });
}

export async function generateCertificateViaGas(
  env: Env,
  params: {
    studentName: string;
    studentCode: string;
    academicYear: string;
    term: string;
    subjects: { name: string; score: number }[];
    totalScore: number;
    percentage: number;
    grade: string;
    verificationCode: string;
  }
) {
  return callGas(env, "generatePDF", params) as Promise<{ driveFileId: string; viewUrl: string; downloadUrl: string }>;
}

export async function sendEmailViaGas(
  env: Env,
  params: { to: string; subject: string; body: string }
) {
  return callGas(env, "sendEmail", params) as Promise<{ success: true }>;
}
