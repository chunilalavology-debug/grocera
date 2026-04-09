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

module.exports = { resolvePublicAssetUrl, firstOrigin };
