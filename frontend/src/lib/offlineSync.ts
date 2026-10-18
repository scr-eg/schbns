// frontend/src/lib/offlineSync.ts
import { getQueuedRequests, removeQueuedRequest, getQueueLength, type QueuedRequest } from "./offlineDb";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

type Listener = (info: { queueLength: number; syncing: boolean }) => void;
const listeners = new Set<Listener>();
let isSyncing = false;

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function notifyQueueChanged() {
  const queueLength = await getQueueLength();
  listeners.forEach((l) => l({ queueLength, syncing: isSyncing }));
}

export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  if (isSyncing || !navigator.onLine) return { succeeded: 0, failed: 0 };
  isSyncing = true;
  await notifyQueueChanged();

  let succeeded = 0;
  let failed = 0;

  try {
    const queue = await getQueuedRequests();
    for (const item of queue) {
      const ok = await sendQueuedItem(item);
      if (ok) {
        await removeQueuedRequest(item.id);
        succeeded++;
      } else {
        failed++;
        break;
      }
    }
  } finally {
    isSyncing = false;
    await notifyQueueChanged();
  }

  return { succeeded, failed };
}

async function sendQueuedItem(item: QueuedRequest): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${item.path}`, {
      method: item.method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
    });
    return res.ok;
  } catch {
    return false;
  }
}

let initialized = false;

export function initOfflineSync() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("online", () => { void flushQueue(); });
  setInterval(() => { if (navigator.onLine) void flushQueue(); }, 20_000);
  if (navigator.onLine) void flushQueue();
}
