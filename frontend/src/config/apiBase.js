/**
 * Single source of truth for the backend API base URL (must end with /api).
 *
 * 1) REACT_APP_API_URL at build time (set in Vercel for the frontend project)
 * 2) Known split Vercel deploys: frontend host → backend /api base (no rebuild)
 * 3) Same-origin /api (only when API is deployed with the static app)
 * 4) Legacy fallback host
 */

const LEGACY_API_FALLBACK = "https://zippyyy.com/api";

/** Frontend hostname → full API base URL including /api */
const VERCEL_HOST_API_MAP = {
  "grocera-osi8.vercel.app": "https://grocera-k45u.vercel.app/api",
};

function stripTrailingSlashes(s) {
  return s.replace(/\/+$/, "");
}

/**
 * @returns {string} e.g. https://backend.vercel.app/api
 */
export function getApiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return stripTrailingSlashes(String(fromEnv).trim());
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
    const mapped = VERCEL_HOST_API_MAP[host];
    if (mapped) {
      return stripTrailingSlashes(mapped);
    }
    return `${stripTrailingSlashes(window.location.origin)}/api`;
  }

  return stripTrailingSlashes(LEGACY_API_FALLBACK);
}

/** Origin only (no /api), for resolving relative image paths */
export function getApiOrigin() {
  return stripTrailingSlashes(getApiBaseUrl().replace(/\/api\/?$/, ""));
}
