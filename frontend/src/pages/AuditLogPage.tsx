import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  user_username: string | null;
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  async function load() {
    const params = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : "";
    const res = await apiGet<{ data: AuditLogRow[]; total: number }>(`/audit-logs${params}`);
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    apiGet<{ data: { action: string }[] }>("/audit-logs/action-types").then((r) => setActionTypes(r.data.map((a) => a.action)));
  }, []);

  useEffect(() => { load(); }, [actionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">سجل العمليات (Audit Log)</h1>
      <p className="text-xs text-gray-400 mb-6">
        سجل للعرض فقط — لا يمكن لأي مستخدم مهما كانت صلاحياته حذف أو تعديل أي سطر هنا. الإجمالي: {total}
      </p>

      <select className="border rounded-lg px-3 py-2 text-sm mb-4" value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}>
        <option value="">كل أنواع العمليات</option>
        {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden text-sm">
        {rows.map((row) => (
          <div key={row.id} className="border-t first:border-t-0">
            <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
              className="w-full flex justify-between items-center p-3 text-right hover:bg-gray-50">
              <div>
                <span className="font-medium">{row.action}</span>
                {row.entity_type && <span className="text-gray-400 text-xs mr-2">({row.entity_type})</span>}
              </div>
              <div className="text-xs text-gray-400">
                {row.user_username ?? "نظام"} — {new Date(row.created_at).toLocaleString("ar-EG")}
              </div>
            </button>
            {expandedId === row.id && (
              <div className="bg-gray-50 p-3 text-xs space-y-1">
                {row.reason && <p><span className="text-gray-500">السبب:</span> {row.reason}</p>}
                {row.old_value && <p><span className="text-gray-500">القيمة القديمة:</span> <code className="break-all">{row.old_value}</code></p>}
                {row.new_value && <p><span className="text-gray-500">القيمة الجديدة:</span> <code className="break-all">{row.new_value}</code></p>}
                {row.entity_id && <p><span className="text-gray-500">المعرّف:</span> {row.entity_id}</p>}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-center text-gray-400">لا توجد سجلات مطابقة</p>}
      </div>
    </div>
  );
}
