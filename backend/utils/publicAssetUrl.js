/**
 * Resolve stored branding paths (e.g. /user/site-branding/logo) to absolute URLs
 * for PDF fetch, email clients, and external tools.
 */

function firstOrigin(csv) {
  const s = String(csv || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
  return s || "";
}

/**
 * @param {string} rawPathOrUrl — DB value or env path
 * @param {{ requestBaseUrl?: string }} [opts] — e.g. https://api.example.com from req
 * @returns {string}
 */
function resolvePublicAssetUrl(rawPathOrUrl, opts = {}) {
  const raw = String(rawPathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const fromEnv =
    firstOrigin(process.env.EMAIL_ASSET_BASE_URL) ||
    firstOrigin(process.env.API_PUBLIC_URL) ||
    firstOrigin(process.env.PUBLIC_API_URL) ||
    firstOrigin(process.env.FRONTEND_URL) ||
    firstOrigin(process.env.FRONTEND_URLS);

  const base = String(opts.requestBaseUrl || fromEnv || "").replace(/\/+$/, "");
  if (!base) return raw.startsWith("/") ? raw : `/${raw}`;

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

/**
 * Public base for API routes that serve assets (e.g. GET /api/user/site-branding/logo).
 * Uses EMAIL_ASSET_BASE_URL, API_PUBLIC_URL, or PUBLIC_API_URL only — not FRONTEND_URL
 * (split deploys serve /user/* on the API host, not the React host).
 */
function publicApiAssetRootFromEnv() {
  const apiSeg = String(process.env.API_END_POINT_V1 || "/api").replace(/\/+$/, "") || "/api";
  const raw =
    firstOrigin(process.env.EMAIL_ASSET_BASE_URL) ||
    firstOrigin(process.env.API_PUBLIC_URL) ||
    firstOrigin(process.env.PUBLIC_API_URL);
  if (!raw) return "";
  const base = raw.replace(/\/+$/, "");
  if (/\/api$/i.test(base)) return base;
  return `${base}${apiSeg.startsWith("/") ? "" : "/"}${apiSeg}`.replace(/\/+$/, "");
}

/**
 * Absolute logo URL for emails, PDF fetch, etc. Ensures /user/site-branding/logo is prefixed with .../api.
 */
function resolveStoreLogoUrlForOutbound(rawPathOrUrl) {
  const raw = String(rawPathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const apiRoot = publicApiAssetRootFromEnv();
  if (apiRoot) return resolvePublicAssetUrl(raw, { requestBaseUrl: apiRoot });
  return resolvePublicAssetUrl(raw, {});
}

module.exports = {
  resolvePublicAssetUrl,
  firstOrigin,
  publicApiAssetRootFromEnv,
  resolveStoreLogoUrlForOutbound,
};
