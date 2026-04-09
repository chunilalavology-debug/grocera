const nodemailer = require("nodemailer");
const AppSettings = require("../db/models/AppSettings");

/**
 * MAIL_TRANSPORT:
 * - `smtp` (default): Nodemailer SMTP using DB + env (requires auth unless open relay).
 * - `sendmail`: local sendmail pipe (typical on Linux servers).
 */
function mailTransportMode() {
  return String(process.env.MAIL_TRANSPORT || "smtp").trim().toLowerCase();
}

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

function buildFromHeader(settings, mergedForSmtp) {
  const smtpUser = String(
    mergedForSmtp?.smtpUser || settings?.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || ""
  ).trim();
  const fromEmail = String(
    settings?.smtpFromEmail ||
      mergedForSmtp?.smtpFromEmail ||
      smtpUser ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.EMAIL_USER ||
      ""
  ).trim();
  const fromName = String(
    settings?.smtpFromName || mergedForSmtp?.smtpFromName || process.env.SMTP_FROM_NAME || "Zippyyy"
  ).trim();
  if (!fromEmail) {
    const err = new Error("From email is not configured (smtpFromEmail / smtpUser / EMAIL_USER).");
    err.code = "FROM_NOT_CONFIGURED";
    throw err;
  }
  return `"${fromName}" <${fromEmail}>`;
}

function createSendmailTransport() {
  const path = String(process.env.SENDMAIL_PATH || "sendmail").trim();
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path,
  });
}

function createSmtpTransport(settings) {
  const opts = smtpOptsFromDoc(settings);
  if (!opts.auth) {
    const err = new Error(
      "SMTP is not configured. Set MAIL_TRANSPORT=sendmail on hosts with sendmail, or add SMTP credentials under Admin → Email."
    );
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }
  return nodemailer.createTransport(opts);
}

async function createMailTransport(settings) {
  const mode = mailTransportMode();
  if (mode === "sendmail") {
    return { transporter: createSendmailTransport(), mode: "sendmail" };
  }
  return { transporter: createSmtpTransport(settings), mode: "smtp" };
}

async function sendMail({ to, subject, html, text }) {
  if (!to) {
    const err = new Error("No recipient email");
    err.code = "NO_RECIPIENT";
    throw err;
  }
  const settings = await loadSettings();
  const { transporter } = await createMailTransport(settings);
  const from = buildFromHeader(settings, settings);
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
  const mode = mailTransportMode();
  let transporter;
  if (mode === "sendmail") {
    transporter = createSendmailTransport();
  } else {
    transporter = createSmtpTransport(merged);
  }
  const from = buildFromHeader(stored, merged);
  return transporter.sendMail({ from, to, subject, html, text });
}

module.exports = {
  sendMail,
  sendMailWithOverrides,
  verifySmtpConfig,
  smtpOptsFromDoc,
  loadSettings,
  mergeSmtpSettings,
  mailTransportMode,
  createMailTransport,
};
