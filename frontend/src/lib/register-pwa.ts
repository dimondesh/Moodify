import { Workbox } from "workbox-window";

/**
 * Same lifecycle as vite-plugin-pwa `registerType: "autoUpdate"`, but never
 * forces `location.reload()` while offline. iOS standalone PWA cold-starts
 * without network often break on that reload (blank white screen).
 */
export function registerPwaAutoUpdate(): void {
  // vite-plugin-pwa has devOptions.enabled: false — /sw.js is not served in dev
  // and Vite's SPA fallback returns index.html (text/html), which breaks registration.
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;

  const scopePath = import.meta.env.BASE_URL || "/";
  const swRoot = new URL(scopePath, self.location.origin).href;
  const swUrl = new URL("sw.js", swRoot).href;

  const wb = new Workbox(swUrl, { scope: scopePath });

  wb.addEventListener("activated", (event) => {
    if (!event.isUpdate && !event.isExternal) return;
    if (!navigator.onLine) return;
    window.location.reload();
  });

  void wb.register({ immediate: true });
}
