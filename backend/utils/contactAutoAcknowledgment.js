/**
 * Automatic contact-form thank-you (email + stored on Contact). Use {{name}} or {name} for the customer name.
 */

/** Built-in template when the database field is empty. */
const DEFAULT_CONTACT_AUTO_REPLY_TEMPLATE = [
  "Dear {{name}},",
  "",
  "Thank you for contacting us. We have received your message and truly appreciate you taking the time to reach out.",
  "",
  "Our team will review your inquiry and respond as soon as possible — usually within one business day. If your request is time-sensitive, please reply to your confirmation email or contact us again and reference your subject line so we can help you faster.",
  "",
  "We value your patience and look forward to assisting you.",
  "",
  "Warm regards,",
  "The Zippyyy Team",
].join("\n");

function substituteName(template, customerName) {
  const n =
    customerName && String(customerName).trim()
      ? String(customerName).trim()
      : "there";
  return String(template)
    .replace(/\{\{\s*name\s*\}\}/gi, n)
    .replace(/\{name\}/gi, n);
}

/**
 * @param {string|null|undefined} storedFromDb - trimmed custom template, or null/empty to use default
 * @param {string} customerName
 */
function resolveContactAutoReplyMessage(storedFromDb, customerName) {
  const raw = storedFromDb != null ? String(storedFromDb).trim() : "";
  const base = raw ? raw : DEFAULT_CONTACT_AUTO_REPLY_TEMPLATE;
  return substituteName(base, customerName);
}

function buildContactAutoAcknowledgment(customerName) {
  return resolveContactAutoReplyMessage(null, customerName);
}

function buildContactAutoAcknowledgmentHtml(customerName, storedTemplate) {
  const plain = resolveContactAutoReplyMessage(
    storedTemplate != null && String(storedTemplate).trim() ? String(storedTemplate).trim() : null,
    customerName,
  );
  return plain
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br />" : `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`))
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  DEFAULT_CONTACT_AUTO_REPLY_TEMPLATE,
  resolveContactAutoReplyMessage,
  buildContactAutoAcknowledgment,
  buildContactAutoAcknowledgmentHtml,
  escapeHtml,
};
