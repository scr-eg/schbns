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

export async function uploadFileToGas(
  env: Env,
  params: { fileName: string; base64Data: string; mimeType: string; subFolder: string }
) {
  return callGas(env, "upload", params) as Promise<{ driveFileId: string; viewUrl: string; downloadUrl: string }>;
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
