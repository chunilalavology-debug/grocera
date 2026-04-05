const nodemailer = require("nodemailer");
const AppSettings = require("../db/models/AppSettings");

/**
 * Build Nodemailer transport options from AppSettings doc + env fallbacks.
 * @param {object|null|undefined} settings lean AppSettings
 */
function smtpOptsFromDoc(settings) {
  const host = String(
    settings?.smtpHost || process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com"
  ).trim();
  const port = Number(settings?.smtpPort || process.env.SMTP_PORT || process.env.EMAIL_PORT || 587) || 587;
  const enc = String(settings?.smtpEncryption || process.env.SMTP_ENCRYPTION || "tls").toLowerCase();
  let secure = enc === "ssl" || port === 465;
  if (enc === "none") secure = false;
  const user = String(settings?.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  let pass = "";
  if (settings && typeof settings.smtpPass === "string" && settings.smtpPass.length > 0) {
    pass = settings.smtpPass;
  } else {
    pass = String(process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  }
  const auth = user && pass ? { user, pass } : null;
  return { host, port, secure, auth };
}

/**
 * Merge persisted settings with request overrides (for verify / test before save).
 * If overrides.smtpPass is empty, uses stored password when present.
 */
function mergeSmtpSettings(stored, overrides = {}) {
  const o = { ...(stored || {}), ...overrides };
  if (!overrides.smtpPass && stored && stored.smtpPass) {
    o.smtpPass = stored.smtpPass;
  }
  return o;
}

async function loadSettings() {
  try {
    return await AppSettings.findOne().lean();
  } catch {
    return null;
  }
}

async function sendMail({ to, subject, html, text }) {
  if (!to) {
    const err = new Error("No recipient email");
    err.code = "NO_RECIPIENT";
    throw err;
  }
  const settings = await loadSettings();
  const opts = smtpOptsFromDoc(settings);
  if (!opts.auth) {
    const err = new Error(
      "SMTP is not configured. Add credentials under Admin → Settings → Email or set EMAIL_USER / EMAIL_PASS."
    );
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }
  const transporter = nodemailer.createTransport(opts);
  const fromEmail = String(
    settings?.smtpFromEmail ||
      settings?.smtpUser ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.EMAIL_USER ||
      opts.auth.user
  ).trim();
  const fromName = String(settings?.smtpFromName || process.env.SMTP_FROM_NAME || "Zippyyy").trim();
  const from = `"${fromName}" <${fromEmail}>`;
  return transporter.sendMail({ from, to, subject, html, text });
}

/**
 * Verify SMTP with optional overrides (same shape as AppSettings SMTP fields).
 */
async function verifySmtpConfig(overrides = {}) {
  const stored = await loadSettings();
  const merged = mergeSmtpSettings(stored, overrides);
  const opts = smtpOptsFromDoc(merged);
  if (!opts.auth) {
    const err = new Error("SMTP username and password are required for verification.");
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }
  const transporter = nodemailer.createTransport(opts);
  await transporter.verify();
  return true;
}

/**
 * Send using merged DB settings + overrides (for “test email” before save).
 */
async function sendMailWithOverrides(overrides = {}, { to, subject, html, text }) {
  if (!to) {
    const err = new Error("No recipient email");
    err.code = "NO_RECIPIENT";
    throw err;
  }
  const stored = await loadSettings();
  const merged = mergeSmtpSettings(stored, overrides);
  const opts = smtpOptsFromDoc(merged);
  if (!opts.auth) {
    const err = new Error("SMTP username and password are required.");
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }
  const transporter = nodemailer.createTransport(opts);
  const fromEmail = String(
    merged?.smtpFromEmail ||
      merged?.smtpUser ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.EMAIL_USER ||
      opts.auth.user
  ).trim();
  const fromName = String(merged?.smtpFromName || process.env.SMTP_FROM_NAME || "Zippyyy").trim();
  const from = `"${fromName}" <${fromEmail}>`;
  return transporter.sendMail({ from, to, subject, html, text });
}

module.exports = {
  sendMail,
  sendMailWithOverrides,
  verifySmtpConfig,
  smtpOptsFromDoc,
  loadSettings,
  mergeSmtpSettings,
};
