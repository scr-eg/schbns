import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { apiGet } from "../lib/api";

type Range = "daily" | "weekly" | "monthly";
interface Kpi { pageViews: number; uniqueVisitors: number }
interface Resp {
  series: { bucket: string; pageViews: number; uniqueVisitors: number }[];
  totals: { today: Kpi; last7Days: Kpi; last30Days: Kpi };
  topPages: { path: string; views: number }[];
  devices: { device: string; views: number }[];
}

const RANGES: { id: Range; label: string }[] = [
  { id: "daily", label: "يومي (30 يومًا)" },
  { id: "weekly", label: "أسبوعي (12 أسبوعًا)" },
  { id: "monthly", label: "شهري (12 شهرًا)" },
];
const DEVICE_LABEL: Record<string, string> = { mobile: "موبايل", desktop: "كمبيوتر", tablet: "تابلت" };

export default function VisitorAnalyticsPage() {
  const [range, setRange] = useState<Range>("daily");
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    apiGet<Resp>(`/analytics/visitors?range=${range}`).then(setData).catch((e) => setError(e.message));
  }, [range]);

  const totalDevices = data?.devices.reduce((s, d) => s + d.views, 0) ?? 0;

  return (
    <div className="p-6">
      <Link to="/dashboard" className="text-sm text-gray-500">← لوحة التحكم</Link>
      <h1 className="text-xl font-bold mt-2 mb-1">إحصائيات الزوار</h1>
      <p className="text-xs text-gray-400 mb-6">
        إحصاءات مجهولة بالكامل: لا تُخزَّن عناوين IP ولا كوكيز، والبصمة تتغير يوميًا. تُحتسب الصفحات العامة فقط (بتوقيت القاهرة).
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {([["اليوم", data?.totals.today], ["آخر 7 أيام", data?.totals.last7Days], ["آخر 30 يومًا", data?.totals.last30Days]] as const).map(
          ([label, k]) => (
            <div key={label} className="border rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-2xl font-bold">{k?.uniqueVisitors ?? "—"}</div>
              <div className="text-xs text-gray-500">زائر فريد · {k?.pageViews ?? 0} مشاهدة صفحة</div>
            </div>
          )
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => setRange(r.id)}
            className={`px-4 py-2 rounded-lg border text-sm ${range === r.id ? "bg-emerald-800 text-white" : ""}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="border rounded-xl p-4 mb-6" dir="ltr" style={{ height: 320 }}>
        {data && data.series.length === 0 ? (
          <p className="text-center text-gray-400 text-sm pt-28" dir="rtl">لا توجد زيارات مسجّلة في هذه الفترة بعد.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pageViews" name="مشاهدات الصفحات" fill="#a7d3c8" />
              <Line dataKey="uniqueVisitors" name="زوار فريدون" stroke="#0F5C4C" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3 text-sm">أكثر الصفحات زيارة (30 يومًا)</h2>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topPages ?? []).map((p) => (
                <tr key={p.path} className="border-t"><td className="py-1.5" dir="ltr">{p.path}</td><td className="text-left">{p.views}</td></tr>
              ))}
              {data && data.topPages.length === 0 && <tr><td className="text-gray-400 py-2">لا بيانات</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-sm">الأجهزة (30 يومًا)</h2>
          {(data?.devices ?? []).map((d) => (
            <div key={d.device} className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span>{DEVICE_LABEL[d.device] ?? d.device}</span>
                <span>{totalDevices ? Math.round((d.views / totalDevices) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded"><div className="h-2 rounded bg-emerald-700" style={{ width: `${totalDevices ? (d.views / totalDevices) * 100 : 0}%` }} /></div>
            </div>
          ))}
          {data && data.devices.length === 0 && <p className="text-gray-400 text-sm">لا بيانات</p>}
        </div>
      </div>
    </div>
  );
}
