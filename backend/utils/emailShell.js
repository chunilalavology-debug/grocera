const { resolvePublicAssetUrl } = require("./publicAssetUrl");

const SHELL_MARKER = 'data-zippyyy-email-shell="1"';

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Detect legacy bundled templates (old wrap() table) to avoid double-wrapping.
 */
function looksLikeLegacyBundledTemplate(html) {
  const s = String(html || "");
  return (
    /max-width:\s*600px/i.test(s) &&
    /margin:\s*0\s*auto/i.test(s) &&
    /border-radius:\s*10px/i.test(s) &&
    /#0f172a/i.test(s)
  );
}

function shouldApplyShell(html) {
  const s = String(html || "");
  if (!s.trim()) return false;
  if (s.includes(SHELL_MARKER)) return false;
  if (/^[\s]*<!doctype html/i.test(s) || /<html[\s>]/i.test(s)) return false;
  if (looksLikeLegacyBundledTemplate(s)) return false;
  return true;
}

/**
 * @param {object} branding — from loadEmailBrandingContext()
 * @param {string} innerHtml — already variable-substituted body fragment
 */
function wrapEmailHtml(innerHtml, branding) {
  const store = escapeHtml(branding.storeName || "Store");
  const year = escapeHtml(String(branding.currentYear || new Date().getFullYear()));
  const support = branding.supportEmail ? escapeHtml(branding.supportEmail) : "";
  const supportBlock = support
    ? `<a href="mailto:${support}" style="color:#0f766e;text-decoration:none;font-weight:600;">${support}</a>`
    : "";

  const logoUrl = String(branding.storeLogoUrl || "").trim();
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${store}" width="160" style="max-width:160px;height:auto;display:block;border:0;outline:none;text-decoration:none;">`
    : `<div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${store}</div>`;

  const pre = branding.preheader
    ? `<div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
        branding.preheader,
      )}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${store}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${pre}
  <table role="presentation" ${SHELL_MARKER} cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:22px 26px;background:linear-gradient(135deg,#0f172a 0%,#134e4a 100%);">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 26px 8px 26px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 26px 24px 26px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#64748b;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px 0;"><strong style="color:#0f172a;">${store}</strong></p>
              <p style="margin:0;">${supportBlock ? `Questions? Contact us at ${supportBlock}.` : "Thank you for shopping with us."}</p>
              <p style="margin:10px 0 0 0;font-size:11px;color:#94a3b8;">&copy; ${year} ${store}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function loadEmailBrandingContext(extra = {}) {
  const AppSettings = require("../db/models/AppSettings");
  let doc = null;
  try {
    doc = await AppSettings.findOne()
      .select("websiteName websiteLogoUrl adminMail contactFormToEmailPrimary smtpFromEmail")
      .lean();
  } catch {
    doc = null;
  }
  const storeName =
    (doc && String(doc.websiteName || "").trim()) ||
    String(process.env.STORE_NAME || "Zippyyy").trim() ||
    "Zippyyy";
  const support =
    String(doc?.contactFormToEmailPrimary || doc?.adminMail || doc?.smtpFromEmail || process.env.SUPPORT_EMAIL || "").trim() ||
    "";
  const logoAbs = resolvePublicAssetUrl(String(doc?.websiteLogoUrl || "").trim(), {});
  return {
    storeName,
    storeLogoUrl: logoAbs,
    supportEmail: support,
    currentYear: new Date().getFullYear(),
    preheader: extra.preheader || "",
  };
}

async function applyEmailShellIfNeeded(html, brandingExtra = {}) {
  const inner = String(html || "");
  if (!shouldApplyShell(inner)) {
    return inner;
  }
  const branding = { ...(await loadEmailBrandingContext(brandingExtra)), ...brandingExtra };
  return wrapEmailHtml(inner, branding);
}

module.exports = {
  wrapEmailHtml,
  shouldApplyShell,
  applyEmailShellIfNeeded,
  loadEmailBrandingContext,
  SHELL_MARKER,
};
