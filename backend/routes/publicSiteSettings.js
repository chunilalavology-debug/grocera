const AppSettings = require("../db/models/AppSettings");
const { normalizeStoredUploadsUrl } = require("../utils/brandingPublicUrl");

function setNoStoreBrandingHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
}

/**
 * Public storefront branding (no SMTP or admin-only fields).
 * Used by GET /api/settings and GET /api/user/site-settings.
 */
async function getPublicSiteSettings(req, res) {
  try {
    const doc = await AppSettings.findOne().lean();
    const websiteName =
      doc && doc.websiteName != null && String(doc.websiteName).trim() !== ""
        ? String(doc.websiteName).trim()
        : "Zippyyy";
    const websiteLogoUrl = normalizeStoredUploadsUrl(
      doc && doc.websiteLogoUrl ? String(doc.websiteLogoUrl).trim() : "",
    );
    const websiteFaviconUrl = normalizeStoredUploadsUrl(
      doc && doc.websiteFaviconUrl ? String(doc.websiteFaviconUrl).trim() : "",
    );
    setNoStoreBrandingHeaders(res);
    return res.json({
      success: true,
      data: {
        websiteName,
        websiteLogoUrl,
        websiteFaviconUrl,
        /** Aliases matching common schema names (`logo` / `favicon` URL strings). */
        logo: websiteLogoUrl,
        favicon: websiteFaviconUrl,
      },
    });
  } catch (e) {
    console.error("getPublicSiteSettings error:", e);
    setNoStoreBrandingHeaders(res);
    return res.status(500).json({ success: false, message: "Failed to load site settings" });
  }
}

module.exports = getPublicSiteSettings;
