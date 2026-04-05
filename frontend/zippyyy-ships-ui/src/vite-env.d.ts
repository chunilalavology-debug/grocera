/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional main grocery site URL when Ships opens in a new tab without referrer (e.g. https://yoursite.com/) */
  readonly VITE_STOREFRONT_HOME_URL?: string;
  /** Grocery API base ending in `/api` — enables guest/signed-in label checkout via `/user/shipping/checkout`. */
  readonly VITE_GROCERA_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
