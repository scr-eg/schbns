import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// يسجّل زيارات الصفحات العامة فقط (بدون كوكيز وبدون بيانات شخصية). لا يعمل بدون اتصال ولا يُخزَّن في الطابور.
const PRIVATE_PREFIXES = ["/admin", "/teacher", "/my-results", "/login", "/forgot", "/reset", "/dashboard"];

export default function VisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!navigator.onLine) return;
    if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) return;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
