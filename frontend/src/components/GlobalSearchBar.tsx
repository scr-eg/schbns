import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";

interface SearchResults {
  students: { id: string; student_code: string; full_name: string }[];
  teachers: { id: string; full_name: string }[];
  subjects: { id: string; name_ar: string }[];
  announcements: { id: string; title: string }[];
}

export default function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function handleChange(value: string) {
    setQuery(value);
    if (value.length < 2) { setResults(null); setOpen(false); return; }
    const res = await apiGet<SearchResults>(`/search?q=${encodeURIComponent(value)}`);
    setResults(res);
    setOpen(true);
  }

  const hasResults = results && (
    results.students.length + results.teachers.length + results.subjects.length + results.announcements.length > 0
  );

  return (
    <div className="relative w-full max-w-xs">
      <input
        placeholder="بحث شامل..."
        className="w-full border rounded-lg px-3 py-1.5 text-sm"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg text-sm max-h-80 overflow-y-auto">
          {!hasResults && <p className="p-3 text-gray-400 text-center">لا نتائج</p>}

          {results.students.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-xs text-gray-400">طلاب</p>
              {results.students.map((s) => (
                <button key={s.id} onClick={() => navigate("/admin/students")}
                  className="block w-full text-right px-3 py-1.5 hover:bg-gray-50">
                  {s.full_name} ({s.student_code})
                </button>
              ))}
            </div>
          )}

          {results.teachers.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-xs text-gray-400">معلمون</p>
              {results.teachers.map((t) => (
                <button key={t.id} onClick={() => navigate("/admin/teachers")}
                  className="block w-full text-right px-3 py-1.5 hover:bg-gray-50">
                  {t.full_name}
                </button>
              ))}
            </div>
          )}

          {results.announcements.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-xs text-gray-400">إعلانات</p>
              {results.announcements.map((a) => (
                <button key={a.id} onClick={() => navigate("/news")}
                  className="block w-full text-right px-3 py-1.5 hover:bg-gray-50">
                  {a.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
