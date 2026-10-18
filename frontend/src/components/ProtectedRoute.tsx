import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-10 text-center text-gray-400">جارِ التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role_code)) {
    return (
      <div className="p-10 text-center text-red-600">
        لا تملك صلاحية الوصول لهذه الصفحة.
      </div>
    );
  }

  return <>{children}</>;
}
