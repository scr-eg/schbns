// frontend/src/lib/offlineDb.ts
// طبقة تخزين محلي عبر IndexedDB (بديل localStorage الذي لا يُستخدم لأسباب تتعلق بالحجم والأداء).
// تُستخدم لغرضين:
//   1) تخزين آخر استجابة ناجحة لكل GET (لعرض بيانات قديمة عند انقطاع الاتصال).
//   2) قائمة انتظار (Outbox) لأي طلب POST/PUT/PATCH/DELETE فشل بسبب انقطاع الشبكة،
//      لإعادة إرساله تلقائيًا فور عودة الاتصال.
import { get, set, del, keys, createStore } from "idb-keyval";

const cacheStore = createStore("school-platform-cache", "responses");
const outboxStore = createStore("school-platform-outbox", "requests");

export interface QueuedRequest {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  createdAt: string;
  description: string;
}

export async function cacheResponse(path: string, data: unknown): Promise<void> {
  try {
    await set(path, { data, cachedAt: new Date().toISOString() }, cacheStore);
  } catch {
    // فشل التخزين المحلي لا يجب أن يُفشل الطلب نفسه
  }
}

export async function getCachedResponse<T>(path: string): Promise<{ data: T; cachedAt: string } | undefined> {
  try {
    return (await get(path, cacheStore)) as { data: T; cachedAt: string } | undefined;
  } catch {
    return undefined;
  }
}

export async function enqueueRequest(req: Omit<QueuedRequest, "id" | "createdAt">): Promise<QueuedRequest> {
  const full: QueuedRequest = {
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await set(full.id, full, outboxStore);
  return full;
}

export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  const allKeys = await keys(outboxStore);
  const items = await Promise.all(allKeys.map((k) => get(k, outboxStore) as Promise<QueuedRequest>));
  return items.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedRequest(id: string): Promise<void> {
  await del(id, outboxStore);
}

export async function getQueueLength(): Promise<number> {
  return (await keys(outboxStore)).length;
}
