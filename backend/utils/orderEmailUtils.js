/**
 * Resolve customer email for transactional emails (order confirmation, status).
 */
function getCustomerEmail(order) {
  if (!order) return "";
  const direct = order.customerEmail && String(order.customerEmail).trim();
  if (direct) return direct;
  const u = order.userId;
  if (u && typeof u === "object" && u.email) return String(u.email).trim();
  return "";
}

function getCustomerName(order) {
  if (!order) return "Customer";
  const addr = order.addressId;
  if (addr && typeof addr === "object" && addr.name) return String(addr.name);
  const gs = order.guestShipping;
  if (gs && gs.name) return String(gs.name);
  const u = order.userId;
  if (u && typeof u === "object" && u.name) return String(u.name);
  return "Customer";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  getCustomerEmail,
  getCustomerName,
  escapeHtml,
};
