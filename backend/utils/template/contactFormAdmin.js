const { escapeHtml } = require("../orderEmailUtils");

/**
 * Admin notification for storefront contact form (HTML email).
 */
function contactFormAdminHtml({ name, email, queryType, subject, message }) {
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    queryType: escapeHtml(queryType),
    subject: escapeHtml(subject),
    message: escapeHtml(message).replace(/\n/g, "<br/>"),
  };
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#18181b;color:#fafafa;font-size:18px;font-weight:700;">
              New contact form submission
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <div style="height:48px;width:120px;margin:0 auto 16px;background:#e4e4e7;border-radius:8px;line-height:48px;text-align:center;font-size:11px;color:#71717a;">LOGO</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#3f3f46;line-height:1.6;">
                <tr><td style="padding:6px 0;"><strong>Name</strong></td><td>${safe.name}</td></tr>
                <tr><td style="padding:6px 0;"><strong>Email</strong></td><td><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
                <tr><td style="padding:6px 0;"><strong>Topic</strong></td><td>${safe.queryType}</td></tr>
                <tr><td style="padding:6px 0;vertical-align:top;"><strong>Subject</strong></td><td>${safe.subject}</td></tr>
              </table>
              <div style="margin-top:20px;padding:16px;background:#fafafa;border-radius:8px;border:1px solid #e4e4e7;">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#71717a;margin-bottom:8px;">Message</div>
                <div style="font-size:14px;color:#27272a;">${safe.message}</div>
              </div>
              <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">${escapeHtml(new Date().toLocaleString())}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = contactFormAdminHtml;
