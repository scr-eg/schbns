import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch } from "../lib/api";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  is_read: number;
  created_at: string;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await apiGet<{ data: Notification[]; unreadCount: number }>("/notifications");
    setItems(res.data);
    setUnreadCount(res.unreadCount);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    await apiPatch(`/notifications/${id}/read`, {}, "تعليم إشعار كمقروء").catch(() => null);
    await load();
  }

  async function markAllRead() {
    await apiPost("/notifications/read-all", {});
    await load();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 text-gray-500">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border z-20 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center p-3 border-b">
            <span className="text-sm font-bold">الإشعارات</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs underline text-gray-500">تعليم الكل كمقروء</button>
            )}
          </div>
          {items.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">لا توجد إشعارات</p>}
          {items.map((n) => (
            <button key={n.id} onClick={() => markRead(n.id)}
              className={`block w-full text-right p-3 border-b text-sm hover:bg-gray-50 ${n.is_read ? "opacity-60" : ""}`}>
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
