const Joi = require("joi");
const AppSettings = require("../db/models/AppSettings");
const { normalizeStoredUploadsUrl } = require("../utils/brandingPublicUrl");
const {
  BRANDING_LOGO_API_PATH,
  BRANDING_FAVICON_API_PATH,
  BRANDING_HERO_BANNER_API_PATH,
} = require("../utils/brandingStoredPaths");

const formatJoiErrors = (error) => {
  if (!error.details) return "";
  return error.details.map((d) => d.message.replace(/"/g, "")).join(", ");
};

function brandingResponse(doc) {
  const websiteName =
    doc.websiteName != null && String(doc.websiteName).trim() !== ""
      ? String(doc.websiteName).trim()
      : "Zippyyy";
  const websiteLogoUrl = normalizeStoredUploadsUrl(
    doc.websiteLogoUrl ? String(doc.websiteLogoUrl).trim() : "",
  );
  const websiteFaviconUrl = normalizeStoredUploadsUrl(
    doc.websiteFaviconUrl ? String(doc.websiteFaviconUrl).trim() : "",
  );
  return {
    websiteName,
    websiteLogoUrl,
    websiteFaviconUrl,
    logo: websiteLogoUrl,
    favicon: websiteFaviconUrl,
    marquee: {
      enabled: Boolean(doc?.marquee?.enabled ?? true),
      bgColor: String(doc?.marquee?.bgColor || "#e9aa42"),
      textColor: String(doc?.marquee?.textColor || "#ffffff"),
      speed: Number(doc?.marquee?.speed || 35),
      slides:
        Array.isArray(doc?.marquee?.slides) && doc.marquee.slides.length > 0
          ? doc.marquee.slides.map((s) => String(s || "").trim()).filter(Boolean)
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
      image: normalizeStoredUploadsUrl(doc?.heroBanner?.image ? String(doc.heroBanner.image).trim() : ""),
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
  };
}

/**
 * PUT /api/settings — admin only (Bearer + role admin).
 * Updates singleton branding fields only (partial body OK).
 */
async function putSiteBrandingSettings(req, res) {
  const schema = Joi.object({
    websiteName: Joi.string().trim().max(120).allow("").optional(),
    websiteLogoUrl: Joi.string().trim().max(2048).allow("", null).optional(),
    websiteFaviconUrl: Joi.string().trim().max(2048).allow("", null).optional(),
    logo: Joi.string().trim().max(2048).allow("", null).optional(),
    favicon: Joi.string().trim().max(2048).allow("", null).optional(),
    marquee: Joi.object({
      enabled: Joi.boolean().optional(),
      bgColor: Joi.string().trim().max(32).optional(),
      textColor: Joi.string().trim().max(32).optional(),
      speed: Joi.number().min(8).max(120).optional(),
      slides: Joi.array().items(Joi.string().trim().max(180)).min(1).max(12).optional(),
    }).optional(),
    header: Joi.object({
      isFixed: Joi.boolean().optional(),
    }).optional(),
    heroBanner: Joi.object({
      image: Joi.string().trim().max(2048).allow("", null).optional(),
      overlayColor: Joi.string().trim().max(64).allow("", null).optional(),
    }).optional(),
    socialLinks: Joi.object({
      facebook: Joi.string().trim().max(2048).allow("", null).optional(),
      instagram: Joi.string().trim().max(2048).allow("", null).optional(),
      linkedin: Joi.string().trim().max(2048).allow("", null).optional(),
      twitter: Joi.string().trim().max(2048).allow("", null).optional(),
      snapchat: Joi.string().trim().max(2048).allow("", null).optional(),
      whatsapp: Joi.string().trim().max(2048).allow("", null).optional(),
    }).optional(),
  });

  try {
    const raw = req.body ?? {};
    const body = await schema.validateAsync(raw, { abortEarly: true });
    const $set = {};
    const $unset = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(raw, k);

    if (has("websiteName")) {
      $set.websiteName = String(body.websiteName ?? "").trim() || "Zippyyy";
    }
    if (has("websiteLogoUrl")) {
      const v = normalizeStoredUploadsUrl(
        body.websiteLogoUrl == null ? "" : String(body.websiteLogoUrl).trim(),
      );
      if (v === BRANDING_LOGO_API_PATH) {
        return res.status(400).json({
          success: false,
          message: "Use admin “Upload logo” (POST /admin/settings/upload-logo), not this URL in PUT /settings.",
        });
      }
      $set.websiteLogoUrl = v;
      if (!v || v !== BRANDING_LOGO_API_PATH) {
        $unset.websiteLogoBinary = 1;
        $unset.websiteLogoContentType = 1;
      }
    } else if (has("logo")) {
      const v = normalizeStoredUploadsUrl(body.logo == null ? "" : String(body.logo).trim());
      if (v === BRANDING_LOGO_API_PATH) {
        return res.status(400).json({
          success: false,
          message: "Use admin upload-logo; do not set logo to the internal path.",
        });
      }
      $set.websiteLogoUrl = v;
      if (!v || v !== BRANDING_LOGO_API_PATH) {
        $unset.websiteLogoBinary = 1;
        $unset.websiteLogoContentType = 1;
      }
    }
    if (has("websiteFaviconUrl")) {
      const v = normalizeStoredUploadsUrl(
        body.websiteFaviconUrl == null ? "" : String(body.websiteFaviconUrl).trim(),
      );
      if (v === BRANDING_FAVICON_API_PATH) {
        return res.status(400).json({
          success: false,
          message: "Use admin upload-favicon (POST /admin/settings/upload-favicon).",
        });
      }
      $set.websiteFaviconUrl = v;
      if (!v || v !== BRANDING_FAVICON_API_PATH) {
        $unset.websiteFaviconBinary = 1;
        $unset.websiteFaviconContentType = 1;
      }
    } else if (has("favicon")) {
      const v = normalizeStoredUploadsUrl(body.favicon == null ? "" : String(body.favicon).trim());
      if (v === BRANDING_FAVICON_API_PATH) {
        return res.status(400).json({
          success: false,
          message: "Use admin upload-favicon; do not set favicon to the internal path.",
        });
      }
      $set.websiteFaviconUrl = v;
      if (!v || v !== BRANDING_FAVICON_API_PATH) {
        $unset.websiteFaviconBinary = 1;
        $unset.websiteFaviconContentType = 1;
      }
    }

    if (has("marquee")) {
      const enabled = body?.marquee?.enabled;
      const bgColor = body?.marquee?.bgColor;
      const textColor = body?.marquee?.textColor;
      const speed = body?.marquee?.speed;
      const slides = body?.marquee?.slides;
      if (typeof enabled === "boolean") $set["marquee.enabled"] = enabled;
      if (bgColor !== undefined) $set["marquee.bgColor"] = String(bgColor || "").trim() || "#e9aa42";
      if (textColor !== undefined) $set["marquee.textColor"] = String(textColor || "").trim() || "#ffffff";
      if (speed !== undefined) $set["marquee.speed"] = Number(speed) || 35;
      if (Array.isArray(slides)) {
        const cleanedSlides = slides.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 12);
        $set["marquee.slides"] = cleanedSlides.length
          ? cleanedSlides
          : [
              "🥦 Fresh groceries delivered to your door – shop with ease 🥕",
              "🥦 Free delivery on orders over $50 – order now! 🥕",
              "🥦 Best quality, best prices – Zippyyy has it all 🥕",
            ];
      }
    }

    if (has("header") && body?.header && Object.prototype.hasOwnProperty.call(body.header, "isFixed")) {
      $set["header.isFixed"] = Boolean(body.header.isFixed);
    }

    if (has("heroBanner")) {
      if (Object.prototype.hasOwnProperty.call(body.heroBanner || {}, "image")) {
        const v = normalizeStoredUploadsUrl(
          body.heroBanner?.image == null ? "" : String(body.heroBanner.image).trim(),
        );
        if (v === BRANDING_HERO_BANNER_API_PATH) {
          return res.status(400).json({
            success: false,
            message: "Use admin hero upload endpoint for internal hero image path.",
          });
        }
        $set["heroBanner.image"] = v;
        if (!v || v !== BRANDING_HERO_BANNER_API_PATH) {
          $unset["heroBanner.imageBinary"] = 1;
          $unset["heroBanner.imageContentType"] = 1;
        }
      }
      if (Object.prototype.hasOwnProperty.call(body.heroBanner || {}, "overlayColor")) {
        $set["heroBanner.overlayColor"] =
          String(body.heroBanner.overlayColor || "").trim() || "rgba(0,0,0,0.45)";
      }
    }

    if (has("socialLinks") && body?.socialLinks) {
      const keys = ["facebook", "instagram", "linkedin", "twitter", "snapchat", "whatsapp"];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body.socialLinks, key)) {
          $set[`socialLinks.${key}`] = String(body.socialLinks[key] ?? "").trim();
        }
      }
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return res.status(400).json({ success: false, message: "No settings fields to update" });
    }

    const upd = {};
    if (Object.keys($set).length) upd.$set = $set;
    if (Object.keys($unset).length) upd.$unset = $unset;
    const doc = await AppSettings.findOneAndUpdate(
      {},
      upd,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    });
    return res.json({ success: true, data: brandingResponse(doc) });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ success: false, message: formatJoiErrors(error) });
    }
    console.error("putSiteBrandingSettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to save settings" });
  }
}

module.exports = putSiteBrandingSettings;
