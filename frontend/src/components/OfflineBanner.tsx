import { useEffect, useState } from "react";
import { subscribeToQueue, flushQueue } from "../lib/offlineSync";
import { getQueueLength } from "../lib/offlineDb";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    getQueueLength().then(setQueueLength);
    const unsubscribe = subscribeToQueue(({ queueLength: len, syncing: sync }) => {
      setQueueLength((prevLen) => {
        if (prevLen > 0 && len === 0 && !sync) setJustSynced(true);
        return len;
      });
      setSyncing(sync);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!justSynced) return;
    const timeout = setTimeout(() => setJustSynced(false), 4000);
    return () => clearTimeout(timeout);
  }, [justSynced]);

  if (isOnline && queueLength === 0 && !justSynced) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 text-center text-sm py-2 px-4 ${
        !isOnline ? "bg-amber-500 text-white" : justSynced ? "bg-green-600 text-white" : "bg-blue-600 text-white"
      }`}
    >
      {!isOnline && (
        <span>
          📡 أنت غير متصل بالإنترنت — يعمل التطبيق بالبيانات المخزَّنة محليًا
          {queueLength > 0 && ` (${queueLength} عملية بانتظار المزامنة)`}
        </span>
      )}
      {isOnline && syncing && <span>🔄 جارِ مزامنة العمليات المعلَّقة...</span>}
      {isOnline && !syncing && queueLength > 0 && (
        <span>
          {queueLength} عملية بانتظار المزامنة —{" "}
          <button onClick={() => flushQueue()} className="underline">مزامنة الآن</button>
        </span>
      )}
      {isOnline && justSynced && queueLength === 0 && <span>✓ تمت مزامنة كل العمليات المعلَّقة بنجاح</span>}
    </div>
  );
}
