/**
 * Quick SMTP check against DB AppSettings + env fallbacks.
 * Usage (from backend folder): node script/testSmtp.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { verifySmtpConfig } = require("../utils/mailService");

async function main() {
  const uri = (process.env.MONGO_URI || process.env.DB_STRING || "").trim();
  if (!uri) {
    console.error("Set MONGO_URI or DB_STRING to load AppSettings.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await verifySmtpConfig({});
    console.log("OK: SMTP verify succeeded.");
  } catch (e) {
    console.error("FAIL:", e.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
