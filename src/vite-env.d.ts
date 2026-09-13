/// <reference types="vite/client" />

/**
 * Only variables prefixed with `VITE_` are exposed to the browser bundle, and
 * they are therefore public. Never add secrets here.
 */
interface ImportMetaEnv {
  readonly VITE_NIM_BASE_URL?: string;
  readonly VITE_NIM_TIMEOUT_MS?: string;
  readonly VITE_NIM_STREAM_IDLE_TIMEOUT_MS?: string;
  readonly VITE_NIM_ENDPOINT_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
