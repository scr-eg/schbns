import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { initOfflineSync } from "./lib/offlineSync";
import OfflineBanner from "./components/OfflineBanner";
import "./i18n";
import "./styles/index.css";

// تفعيل مزامنة العمليات المؤجَّلة فور توفر الاتصال (مرة واحدة عند بدء التطبيق)
initOfflineSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <OfflineBanner />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
