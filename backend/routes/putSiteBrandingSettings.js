const Joi = require("joi");
const AppSettings = require("../db/models/AppSettings");
const { normalizeStoredUploadsUrl } = require("../utils/brandingPublicUrl");

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
    const has = (k) => Object.prototype.hasOwnProperty.call(raw, k);

    if (has("websiteName")) {
      $set.websiteName = String(body.websiteName ?? "").trim() || "Zippyyy";
    }
    if (has("websiteLogoUrl")) {
      $set.websiteLogoUrl = normalizeStoredUploadsUrl(
        body.websiteLogoUrl == null ? "" : String(body.websiteLogoUrl).trim(),
      );
    } else if (has("logo")) {
      $set.websiteLogoUrl = normalizeStoredUploadsUrl(body.logo == null ? "" : String(body.logo).trim());
    }
    if (has("websiteFaviconUrl")) {
      $set.websiteFaviconUrl = normalizeStoredUploadsUrl(
        body.websiteFaviconUrl == null ? "" : String(body.websiteFaviconUrl).trim(),
      );
    } else if (has("favicon")) {
      $set.websiteFaviconUrl = normalizeStoredUploadsUrl(
        body.favicon == null ? "" : String(body.favicon).trim(),
      );
    }

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ success: false, message: "No branding fields to update" });
    }

    const doc = await AppSettings.findOneAndUpdate(
      {},
      { $set },
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
