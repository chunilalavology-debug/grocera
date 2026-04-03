/**
 * Single source of truth for the backend API base URL (must end with /api).
 *
 * 1) REACT_APP_API_URL at build time (set in Vercel for the frontend project)
 * 2) Known split Vercel deploys: frontend host → backend /api base (no rebuild)
 * 3) Same-origin /api (only when API is deployed with the static app)
 * 4) Legacy fallback host
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
  if (fromEnv && String(fromEnv).trim()) {
    return stripTrailingSlashes(String(fromEnv).trim());
  }

  const isDev =
    typeof process.env.NODE_ENV !== "undefined" &&
    process.env.NODE_ENV === "development";

  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return "http://localhost:5000/api";
    }

    if (isDev && isPrivateLanHost(host)) {
      return `http://${host}:5000/api`;
    }

    const mapped = VERCEL_HOST_API_MAP[host];
    if (mapped) {
      return stripTrailingSlashes(mapped);
    }

    if (isDev) {
      return "http://localhost:5000/api";
    }

    /**
     * Production: CRA on Vercel does not serve /api — calling same-origin breaks products.
     * Use mapped backend, env fallback, or default split-deploy URL.
     */
    if (isVercelFrontendHost(host)) {
      return getSplitDeployFallbackApi();
    }

    return `${stripTrailingSlashes(window.location.origin)}/api`;
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
