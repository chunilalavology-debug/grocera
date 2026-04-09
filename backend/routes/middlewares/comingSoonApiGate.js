const AppSettings = require("../../db/models/AppSettings");

let API_END_POINT_V1 =
  String(process.env.API_END_POINT_V1 || "/api").replace(/\/+$/, "") || "/api";
if (!API_END_POINT_V1.startsWith("/")) {
  API_END_POINT_V1 = `/${API_END_POINT_V1}`;
}
const A = API_END_POINT_V1;

function normalizePathname(p) {
  let s = String(p || "")
    .split("?")[0]
    .trim();
  if (!s) s = "/";
  if (!s.startsWith("/")) s = `/${s}`;
  s = s.replace(/\/+/g, "/");
  if (s.length > 1) s = s.replace(/\/$/, "");
  return s;
}

/** @type {{ at: number, siteWide: boolean } | null} */
let comingSoonCache = null;
const CACHE_MS = Number(process.env.COMING_SOON_CACHE_MS || 2500);

async function isSiteWideComingSoonEnabled() {
  const now = Date.now();
  if (comingSoonCache && now - comingSoonCache.at < CACHE_MS) {
    return comingSoonCache.siteWide;
  }
  let siteWide = false;
  try {
    const doc = await AppSettings.findOne().select("comingSoon.siteWideEnabled").lean();
    siteWide = Boolean(doc?.comingSoon?.siteWideEnabled);
  } catch (e) {
    console.error("[comingSoonApiGate] settings read:", e?.message || e);
  }
  comingSoonCache = { at: now, siteWide };
  return siteWide;
}

function invalidateComingSoonCache() {
  comingSoonCache = null;
}

/**
 * When site-wide coming soon is ON, block storefront API traffic. Admins, auth, branding, and webhooks stay open.
 */
function comingSoonApiGate(req, res, next) {
  /**
   * Deprecated global gate: app now uses Zippy Ships route-level coming soon only.
   * Keep middleware as passthrough to avoid breaking older imports.
   */
  return next();
}

module.exports = {
  comingSoonApiGate,
  invalidateComingSoonCache,
};
