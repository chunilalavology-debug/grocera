/**
 * Single source of truth for the backend API base URL (must end with /api).
 *
 * 1) Local dev (npm start on localhost / LAN): same-origin /api → setupProxy.js → backend :5000
 * 2) REACT_APP_API_URL when set (production / REACT_APP_FORCE_REMOTE_API for local)
 * 3) Known split Vercel deploys + fallbacks for static hosting
 * 4) REACT_APP_SAME_ORIGIN_API=1 when API is reverse-proxied on the same host as the SPA
 */

const LEGACY_API_FALLBACK = "https://zippyyy.com/api";

/**
 * Default backend when frontend is on *.vercel.app but API is a separate Vercel project
 * (same-origin /api would hit the static app — no API). Override via REACT_APP_API_URL or REACT_APP_API_FALLBACK_URL.
 */
const DEFAULT_SPLIT_BACKEND_API = "https://grocera-k45u.vercel.app/api";

/** Frontend hostname → full API base URL including /api */
const VERCEL_HOST_API_MAP = {
  "grocera-osi8.vercel.app": "https://grocera-k45u.vercel.app/api",
};

function stripTrailingSlashes(s) {
  return s.replace(/\/+$/, "");
}

function isPrivateLanHost(host) {
  if (!host) return false;
  return (
    /^(192\.168\.\d+\.\d+)$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
  );
}

function isVercelFrontendHost(host) {
  if (!host) return false;
  return host.endsWith(".vercel.app") || host.endsWith(".vercel.dev");
}

function getSplitDeployFallbackApi() {
  const fromEnv = process.env.REACT_APP_API_FALLBACK_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return stripTrailingSlashes(String(fromEnv).trim());
  }
  return stripTrailingSlashes(DEFAULT_SPLIT_BACKEND_API);
}

/**
 * @returns {string} e.g. https://backend.vercel.app/api
 */
export function getApiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_URL;
  const isDev =
    typeof process.env.NODE_ENV !== "undefined" &&
    process.env.NODE_ENV === "development";

  /**
   * Local `npm start`: use same-origin `/api` so webpack proxies to :5000 (avoids CORS + broken uploads).
   * Set REACT_APP_FORCE_REMOTE_API=1 to keep using REACT_APP_API_URL from .env while UI is on localhost.
   */
  const forceRemoteApi =
    process.env.REACT_APP_FORCE_REMOTE_API === "1" &&
    fromEnv &&
    String(fromEnv).trim();

  if (!forceRemoteApi && typeof window !== "undefined" && isDev) {
    const host = window.location.hostname;
    const localDevUi =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      isPrivateLanHost(host);
    if (localDevUi) {
      return `${stripTrailingSlashes(window.location.origin)}/api`;
    }
  }

  if (fromEnv && String(fromEnv).trim()) {
    return stripTrailingSlashes(String(fromEnv).trim());
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    const mapped = VERCEL_HOST_API_MAP[host];
    if (mapped) {
      return stripTrailingSlashes(mapped);
    }

    /**
     * Production: CRA on Vercel does not serve /api — calling same-origin breaks products.
     * Use mapped backend, env fallback, or default split-deploy URL.
     */
    if (isVercelFrontendHost(host)) {
      return getSplitDeployFallbackApi();
    }

    /**
     * Custom domain on static hosting: same-origin `/api` often returns `index.html` (uploads see "unexpected HTML").
     * Prefer split backend unless you explicitly serve the API on this host (proxy /api → Node).
     */
    const sameOriginApi =
      typeof process.env.REACT_APP_SAME_ORIGIN_API !== "undefined" &&
      String(process.env.REACT_APP_SAME_ORIGIN_API).trim() === "1";
    if (sameOriginApi) {
      return `${stripTrailingSlashes(window.location.origin)}/api`;
    }

    return getSplitDeployFallbackApi();
  }

  if (isDev) {
    return "http://localhost:5000/api";
  }

  return stripTrailingSlashes(LEGACY_API_FALLBACK);
}

/** Origin only (no /api), for resolving relative image paths */
export function getApiOrigin() {
  return stripTrailingSlashes(getApiBaseUrl().replace(/\/api\/?$/, ""));
}
