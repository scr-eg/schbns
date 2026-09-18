import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar.json";
import en from "./en.json";

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: localStorage.getItem("lang") || "ar",
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

// تحديث اتجاه الصفحة (RTL/LTR) تلقائيًا عند تغيير اللغة
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  localStorage.setItem("lang", lng);
});

export default i18n;
