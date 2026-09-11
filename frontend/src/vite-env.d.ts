/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKETIO_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_BUNNY_PULL_ZONE_HOSTNAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
