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
    const heroImage = normalizeStoredUploadsUrl(
      doc?.heroBanner?.image ? String(doc.heroBanner.image).trim() : "",
    );
    const marqueeSlides = Array.isArray(doc?.marquee?.slides)
      ? doc.marquee.slides.map((s) => String(s || "").trim()).filter(Boolean)
      : [];
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
        marquee: {
          enabled: Boolean(doc?.marquee?.enabled ?? true),
          bgColor: String(doc?.marquee?.bgColor || "#e9aa42"),
          textColor: String(doc?.marquee?.textColor || "#ffffff"),
          speed: Number(doc?.marquee?.speed || 35),
          slides:
            marqueeSlides.length > 0
              ? marqueeSlides
              : [
                  "🥦 Fresh groceries delivered to your door – shop with ease 🥕",
                  "🥦 Free delivery on orders over $50 – order now! 🥕",
                  "🥦 Best quality, best prices – Zippyyy has it all 🥕",
                ],
        },
        header: {
          isFixed: Boolean(doc?.header?.isFixed ?? false),
        },
        heroBanner: {
          image: heroImage,
          overlayColor: String(doc?.heroBanner?.overlayColor || "rgba(0,0,0,0.45)"),
        },
        socialLinks: {
          facebook: String(doc?.socialLinks?.facebook || ""),
          instagram: String(doc?.socialLinks?.instagram || ""),
          linkedin: String(doc?.socialLinks?.linkedin || ""),
          twitter: String(doc?.socialLinks?.twitter || ""),
          snapchat: String(doc?.socialLinks?.snapchat || ""),
          whatsapp: String(doc?.socialLinks?.whatsapp || ""),
        },
      },
    });
  } catch (e) {
    console.error("getPublicSiteSettings error:", e);
    setNoStoreBrandingHeaders(res);
    return res.status(500).json({ success: false, message: "Failed to load site settings" });
  }
}

module.exports = getPublicSiteSettings;
