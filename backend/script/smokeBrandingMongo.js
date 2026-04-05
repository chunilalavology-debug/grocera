/**
 * Read branding fields from MongoDB (no HTTP).
 *
 *   cross-env DB_STRING="mongodb+srv://..." node script/smokeBrandingMongo.js
 *
 * Does not print credentials. Exit 0 when connected.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { mongoBinaryToBuffer } = require("../utils/mongoBinaryToBuffer");

async function main() {
  const uri = (process.env.MONGO_URI || process.env.DB_STRING || "").trim();
  if (!uri) {
    console.error("Missing MONGO_URI or DB_STRING");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 2 });
  const AppSettings = require("../db/models/AppSettings");
  const d = await AppSettings.findOne()
    .select("+websiteLogoBinary +websiteFaviconBinary websiteLogoUrl websiteFaviconUrl websiteName")
    .lean();
  const out = {
    ok: true,
    websiteName: d?.websiteName || "",
    websiteLogoUrl: d?.websiteLogoUrl || "",
    websiteFaviconUrl: d?.websiteFaviconUrl || "",
    logoBytes: mongoBinaryToBuffer(d?.websiteLogoBinary).length,
    faviconBytes: mongoBinaryToBuffer(d?.websiteFaviconBinary).length,
  };
  console.log(JSON.stringify(out, null, 2));
  if (out.websiteLogoUrl && out.logoBytes === 0 && String(out.websiteLogoUrl).includes("site-branding")) {
    console.warn(
      "WARN: websiteLogoUrl points at Mongo image route but logo binary is empty (re-upload logo).",
    );
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
