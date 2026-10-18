import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Precache كل ملفات الواجهة المبنية (JS/CSS/HTML) ليعمل الـ Shell كاملًا دون اتصال
      includeAssets: ["icon.svg"],
      manifest: {
        name: "منصة المدرسة",
        short_name: "المدرسة",
        description: "منصة إدارة مدرسية متكاملة تعمل حتى دون اتصال بالإنترنت",
        lang: "ar",
        dir: "rtl",
        theme_color: "#0F5C4C",
        background_color: "#f7f8fa",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "icon.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // لا نُخزِّن استجابات /api عبر Service Worker لأننا نتحكم بذلك يدويًا (IndexedDB في lib/api.ts)
        // بما يسمح بمنطق أدق (قائمة انتظار للكتابة، دمج بيانات...) لا يوفره Cache API وحده
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      devOptions: {
        enabled: false, // تفعيل الـ SW في dev قد يُصعّب تتبع الأخطاء؛ يعمل فعليًا في build/preview
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8787", // عنوان Worker المحلي (wrangler dev)
    },
  },
});
