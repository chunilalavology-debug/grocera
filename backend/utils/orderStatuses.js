/**
 * WooCommerce-inspired + legacy fulfillment statuses (stored on Order.status).
 * @type {readonly string[]}
 */
const ORDER_STATUSES = Object.freeze([
  "session",
  "pending",
  "confirmed",
  "processing",
  "on_hold",
  "packed",
  "shipped",
  "on_the_way",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
  "failed",
]);

const VALID_ADMIN_TRANSITION_STATUSES = ORDER_STATUSES.filter((s) => s !== "session");

function isValidOrderStatus(status) {
  return ORDER_STATUSES.includes(String(status || ""));
}

module.exports = {
  ORDER_STATUSES,
  VALID_ADMIN_TRANSITION_STATUSES,
  isValidOrderStatus,
};
