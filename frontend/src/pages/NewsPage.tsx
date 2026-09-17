import { useEffect, useState } from "react";
import PublicLayout from "../components/PublicLayout";
import { apiGet } from "../lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function NewsPage() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    apiGet<{ data: Announcement[] }>("/announcements?limit=50").then((res) => setItems(res.data));
  }, []);

  return (
    <PublicLayout>
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-6">الأخبار والإعلانات</h1>
        <div className="space-y-4">
          {items.length === 0 && <p className="text-gray-400">لا توجد إعلانات منشورة حاليًا.</p>}
          {items.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-5">
              <p className="font-bold mb-1">{a.title}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{a.body}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString("ar-EG")}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
