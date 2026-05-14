import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import AuthProvider from "./Providers/AuthProvider.tsx";
import "./lib/i18n.ts";
import { HelmetProvider } from "react-helmet-async";
import { registerPwaAutoUpdate } from "./lib/register-pwa";
import { GoogleOAuthProvider } from "@react-oauth/google";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";

const appTree = (
  <HelmetProvider>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </HelmetProvider>
);

createRoot(document.getElementById("root")!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>
  ) : (
    appTree
  ),
);

registerPwaAutoUpdate();
