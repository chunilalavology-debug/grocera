/**
 * Clear internal branding URLs when Mongo binaries are missing (broken images).
 *
 *   cross-env DB_STRING="..." node script/fixOrphanBrandingUrls.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const AppSettings = require("../db/models/AppSettings");
const {
  BRANDING_LOGO_API_PATH,
  BRANDING_FAVICON_API_PATH,
} = require("../utils/brandingStoredPaths");
const { mongoBinaryToBuffer } = require("../utils/mongoBinaryToBuffer");

function byteLen(b) {
  return mongoBinaryToBuffer(b).length;
}

async function main() {
  const uri = (process.env.MONGO_URI || process.env.DB_STRING || "").trim();
  if (!uri) {
    console.error("Missing MONGO_URI or DB_STRING");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 2 });
  const doc = await AppSettings.findOne().select("+websiteLogoBinary +websiteFaviconBinary");
  if (!doc) {
    console.log(JSON.stringify({ ok: true, message: "No AppSettings doc" }));
    await mongoose.disconnect();
    return;
  }
  const $set = {};
  const $unset = {};
  if (String(doc.websiteLogoUrl || "").trim() === BRANDING_LOGO_API_PATH && byteLen(doc.websiteLogoBinary) === 0) {
    $set.websiteLogoUrl = "";
    $unset.websiteLogoBinary = 1;
    $unset.websiteLogoContentType = 1;
  }
  if (String(doc.websiteFaviconUrl || "").trim() === BRANDING_FAVICON_API_PATH && byteLen(doc.websiteFaviconBinary) === 0) {
    $set.websiteFaviconUrl = "";
    $unset.websiteFaviconBinary = 1;
    $unset.websiteFaviconContentType = 1;
  }
  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    console.log(JSON.stringify({ ok: true, message: "Nothing to fix" }));
    await mongoose.disconnect();
    return;
  }
  const upd = {};
  if (Object.keys($set).length) upd.$set = $set;
  if (Object.keys($unset).length) upd.$unset = $unset;
  await AppSettings.findOneAndUpdate({ _id: doc._id }, upd);
  console.log(JSON.stringify({ ok: true, fixed: true, $set, unsetKeys: Object.keys($unset) }));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
