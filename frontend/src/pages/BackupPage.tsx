import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

interface BackupLog {
  id: string;
  triggered_by: string;
  status: "success" | "failed";
  created_at: string;
}

export default function BackupPage() {
  const [logs, setLogs] = useState<BackupLog[]>([]);

  useEffect(() => {
    apiGet<{ data: BackupLog[] }>("/backup/logs").then((r) => setLogs(r.data));
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-2">النسخ الاحتياطي</h1>
      <p className="text-sm text-gray-500 mb-6">
        يعمل النسخ الاحتياطي تلقائيًا يوميًا الساعة 2:00 صباحًا (UTC) عبر GitHub Actions،
        ويُرفع الملف إلى Google Drive عبر Google Apps Script. يمكن أيضًا تشغيله يدويًا فورًا
        من تبويب Actions في مستودع GitHub (workflow: Scheduled D1 Backup).
      </p>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto text-sm">
        <table className="w-full min-w-[400px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right p-3">التاريخ</th>
              <th className="text-right p-3">شُغِّل بواسطة</th>
              <th className="text-right p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-3">{new Date(log.created_at).toLocaleString("ar-EG")}</td>
                <td className="p-3 text-gray-400">{log.triggered_by}</td>
                <td className="p-3">
                  {log.status === "success"
                    ? <span className="text-green-700">نجح</span>
                    : <span className="text-red-600">فشل</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-gray-400">لا يوجد سجل نسخ احتياطي بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
