// frontend/src/lib/api.ts
import { cacheResponse, getCachedResponse, enqueueRequest } from "./offlineDb";
import { notifyQueueChanged } from "./offlineSync";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

/** يُستخدم للتمييز بين خطأ حقيقي من السيرفر وبين "تم حفظ الطلب محليًا وسيُزامَن لاحقًا" */
export class OfflineQueuedError extends Error {
  constructor() {
    super("لا يوجد اتصال بالإنترنت حاليًا. تم حفظ العملية وستتم مزامنتها تلقائيًا فور عودة الاتصال.");
    this.name = "OfflineQueuedError";
  }
}

function isNetworkFailure(err: unknown): boolean {
  // فشل fetch بسبب انقطاع الشبكة يظهر كـ TypeError في كل المتصفحات الحديثة
  return err instanceof TypeError || !navigator.onLine;
}

/** GET: يحاول الشبكة أولًا، يخزّن النتيجة محليًا، ويعود للنسخة المخزَّنة تلقائيًا عند انقطاع الاتصال */
export async function apiGet<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.message || data.error || "حدث خطأ غير متوقع", data);
    await cacheResponse(path, data);
    return data as T;
  } catch (err) {
    if (isNetworkFailure(err)) {
      const cached = await getCachedResponse<T>(path);
      if (cached) return cached.data;
    }
    throw err;
  }
}

/** مسارات لا يجوز تأجيلها في قائمة الانتظار مهما حدث (تتطلب استجابة فورية من الخادم بطبيعتها) */
const NEVER_QUEUE_PREFIXES = ["/auth/", "/certificates/issue"];

function isQueueable(path: string): boolean {
  return !NEVER_QUEUE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** طلب مُعدِّل عام (POST/PUT/PATCH/DELETE) — عند انقطاع الاتصال يُحفظ في قائمة الانتظار بدل الفشل الكامل */
async function mutate<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  offlineDescription: string
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.message || data.error || "حدث خطأ غير متوقع", data);
    return data as T;
  } catch (err) {
    if (isNetworkFailure(err)) {
      if (!isQueueable(path)) {
        throw new ApiError("لا يوجد اتصال بالإنترنت حاليًا. هذا الإجراء يتطلب اتصالاً فعليًا ولا يمكن تأجيله.");
      }
      await enqueueRequest({ method, path, body, description: offlineDescription });
      notifyQueueChanged();
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

export async function apiPost<T>(path: string, body: unknown, offlineDescription = "عملية إرسال بيانات"): Promise<T> {
  return mutate<T>("POST", path, body, offlineDescription);
}
export async function apiPut<T>(path: string, body: unknown, offlineDescription = "تحديث بيانات"): Promise<T> {
  return mutate<T>("PUT", path, body, offlineDescription);
}
export async function apiPatch<T>(path: string, body: unknown, offlineDescription = "تعديل بيانات"): Promise<T> {
  return mutate<T>("PATCH", path, body, offlineDescription);
}
export async function apiDelete<T>(path: string, offlineDescription = "حذف بيانات"): Promise<T> {
  return mutate<T>("DELETE", path, undefined, offlineDescription);
}
