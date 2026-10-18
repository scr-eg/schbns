import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch } from "../lib/api";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  status: "active" | "locked" | "disabled";
  role_code: string;
  role_name: string;
  last_login_at: string | null;
}

interface RoleOption {
  id: string;
  code: string;
  name_ar: string;
}

export default function UsersPage() {
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", roleCode: "" });
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    const res = await apiGet<{ data: UserRow[] }>("/users");
    setUsersList(res.data);
  }

  useEffect(() => {
    loadUsers();
    apiGet<{ data: RoleOption[] }>("/users/roles").then((res) => {
      setRoles(res.data);
      if (res.data[0]) setForm((f) => ({ ...f, roleCode: res.data[0].code }));
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost("/users", form);
      setShowForm(false);
      setForm({ username: "", email: "", password: "", roleCode: roles[0]?.code ?? "" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function toggleStatus(user: UserRow) {
    const newStatus = user.status === "active" ? "disabled" : "active";
    // ⚠️ إجراء أمني حسّاس: إن كان الجهاز غير متصل ستُحفظ العملية وتُنفَّذ فعليًا فقط بعد المزامنة
    await apiPatch(`/users/${user.id}/status`, { status: newStatus }, "تغيير حالة مستخدم").catch(() => null);
    await loadUsers();
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          + مستخدم جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 grid gap-3 max-w-md">
          <input required placeholder="اسم المستخدم" className="border rounded-lg px-3 py-2"
            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input type="email" placeholder="البريد الإلكتروني" className="border rounded-lg px-3 py-2"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required type="password" minLength={8} placeholder="كلمة المرور المبدئية"
            className="border rounded-lg px-3 py-2"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="border rounded-lg px-3 py-2" value={form.roleCode}
            onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
            {roles.map((r) => <option key={r.code} value={r.code}>{r.name_ar}</option>)}
          </select>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="py-2 rounded-lg text-white" style={{ backgroundColor: "var(--color-primary)" }}>
            إنشاء
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-sm min-w-[500px]">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-right p-3">اسم المستخدم</th>
            <th className="text-right p-3">الدور</th>
            <th className="text-right p-3">الحالة</th>
            <th className="text-right p-3">آخر دخول</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {usersList.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.username}</td>
              <td className="p-3">{u.role_name}</td>
              <td className="p-3">
                <span className={u.status === "active" ? "text-green-600" : "text-red-600"}>
                  {u.status === "active" ? "نشط" : u.status === "locked" ? "مقفل" : "معطّل"}
                </span>
              </td>
              <td className="p-3 text-gray-400">{u.last_login_at ?? "—"}</td>
              <td className="p-3">
                <button onClick={() => toggleStatus(u)} className="text-xs underline text-gray-500">
                  {u.status === "active" ? "تعطيل" : "تفعيل"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
