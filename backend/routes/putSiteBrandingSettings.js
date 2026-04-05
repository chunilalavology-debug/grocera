const Joi = require("joi");
const AppSettings = require("../db/models/AppSettings");
const { normalizeStoredUploadsUrl } = require("../utils/brandingPublicUrl");
const {
  BRANDING_LOGO_API_PATH,
  BRANDING_FAVICON_API_PATH,
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

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return res.status(400).json({ success: false, message: "No branding fields to update" });
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
