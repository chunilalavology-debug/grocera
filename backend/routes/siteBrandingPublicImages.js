const AppSettings = require("../db/models/AppSettings");
const { mongoBinaryToBuffer } = require("../utils/mongoBinaryToBuffer");

function sendBuffer(res, buf, contentType) {
  const b = mongoBinaryToBuffer(buf);
  if (!b.length) return false;
  const ct = String(contentType || "").trim() || "application/octet-stream";
  res.set({
    "Content-Type": ct,
    "Cache-Control": "public, max-age=120, s-maxage=120",
  });
  res.send(b);
  return true;
}

async function getSiteBrandingLogo(_req, res) {
  try {
    const doc = await AppSettings.findOne()
      .select("+websiteLogoBinary websiteLogoContentType")
      .lean();
    if (doc && sendBuffer(res, doc.websiteLogoBinary, doc.websiteLogoContentType)) return;
    return res.status(404).end();
  } catch (e) {
    console.error("getSiteBrandingLogo", e);
    return res.status(500).end();
  }
}

async function getSiteBrandingFavicon(_req, res) {
  try {
    const doc = await AppSettings.findOne()
      .select("+websiteFaviconBinary websiteFaviconContentType")
      .lean();
    if (doc && sendBuffer(res, doc.websiteFaviconBinary, doc.websiteFaviconContentType)) return;
    return res.status(404).end();
  } catch (e) {
    console.error("getSiteBrandingFavicon", e);
    return res.status(500).end();
  }
}

module.exports = { getSiteBrandingLogo, getSiteBrandingFavicon };
