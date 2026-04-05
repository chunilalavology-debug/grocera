/**
 * Single source of truth for the backend API base URL (must end with /api).
 *
 * 1) Local dev (npm start on localhost / LAN): same-origin /api → setupProxy.js → backend :5000
 * 2) REACT_APP_API_URL when set (production / REACT_APP_FORCE_REMOTE_API for local)
 * 3) Known split Vercel deploys + fallbacks for static hosting
 * 4) REACT_APP_SAME_ORIGIN_API=1|true when /api is reverse-proxied on the same host as the SPA
 * 5) REACT_APP_UPLOADS_ORIGIN — optional origin (no /api) for GET /uploads/* when only /api is proxied to Node
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

/**
 * When the storefront is on these hosts and REACT_APP_API_URL is unset, assume the Node API
 * is served at the same origin under /api (typical nginx/Caddy proxy). Avoids hitting a
 * fallback host that returns HTML and triggers "API call returned a web page".
 */
const DEFAULT_SAME_ORIGIN_API_HOSTS = new Set(["zippyyy.com", "www.zippyyy.com"]);

function stripTrailingSlashes(s) {
  return s.replace(/\/+$/, "");
}

/** Accepts 1, true, yes (case-insensitive). */
function envFlagTrue(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * Ensures `https://host` → `https://host/api` when the path is empty or `/`.
 * Leaves `http://localhost:5000/api` unchanged.
 */
export function normalizeApiBaseUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
    if (path === "/") {
      u.pathname = "/api";
      return stripTrailingSlashes(u.toString());
    }
    return stripTrailingSlashes(raw);
  } catch {
    return stripTrailingSlashes(raw);
  }
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
    return normalizeApiBaseUrl(String(fromEnv).trim());
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
   * Local `npm start`: always use same-origin `/api` so setupProxy forwards to the grocery API.
   * Otherwise opening the app as http://DESKTOP-NAME:3000 or http://my-pc.local:3000 would skip the
   * proxy and use REACT_APP_API_URL (e.g. http://localhost:5000/api) from the browser — wrong host
   * from other devices and often returns HTML → "API call returned a web page".
   * Set REACT_APP_FORCE_REMOTE_API=1 to call REACT_APP_API_URL directly (CORS must allow your UI origin).
   */
  const forceRemoteApi =
    process.env.REACT_APP_FORCE_REMOTE_API === "1" &&
    fromEnv &&
    String(fromEnv).trim();

  if (!forceRemoteApi && typeof window !== "undefined" && isDev) {
    return `${stripTrailingSlashes(window.location.origin)}/api`;
  }

  if (fromEnv && String(fromEnv).trim()) {
    return normalizeApiBaseUrl(String(fromEnv).trim());
  }

  if (typeof window !== "undefined") {
    if (window.location.protocol === "file:") {
      return stripTrailingSlashes(LEGACY_API_FALLBACK);
    }

    const host = window.location.hostname;

    /**
     * Production preview (serve/build) on loopback or LAN: use same-origin /api so a local static server
     * + reverse proxy (or CRA-like setup) can reach JSON. Avoids falling through to a hard-coded Vercel
     * API URL that returns HTML 404 for /auth/login.
     */
    const isLoopbackOrLan =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1" ||
      isPrivateLanHost(host);

    if (isLoopbackOrLan && !forceRemoteApi) {
      return `${stripTrailingSlashes(window.location.origin)}/api`;
    }

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
     * Custom domain: same-origin `/api` when you reverse-proxy /api → Node.
     * REACT_APP_SAME_ORIGIN_API=1 or true (rebuild required).
     */
    if (envFlagTrue(process.env.REACT_APP_SAME_ORIGIN_API)) {
      return `${stripTrailingSlashes(window.location.origin)}/api`;
    }

    if (DEFAULT_SAME_ORIGIN_API_HOSTS.has(host)) {
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

/**
 * Host that serves GET /uploads/* (often same as getApiOrigin()).
 * Set REACT_APP_UPLOADS_ORIGIN when the SPA uses same-origin /api but static /uploads is not
 * proxied to Node (e.g. only /api is reverse-proxied). No trailing slash.
 */
export function getUploadsOrigin() {
  const raw = process.env.REACT_APP_UPLOADS_ORIGIN;
  if (raw && String(raw).trim()) {
    return stripTrailingSlashes(String(raw).trim());
  }
  return getApiOrigin();
}
