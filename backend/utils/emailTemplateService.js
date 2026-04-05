const EmailTemplate = require("../db/models/EmailTemplate");
const { TEMPLATE_DEFAULTS } = require("./emailTemplateDefaults");
const { getCustomerName, getCustomerEmail } = require("./orderEmailUtils");

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  on_hold: "On hold",
  packed: "Packed",
  shipped: "Shipped",
  on_the_way: "On the way",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const STATUS_MESSAGES = {
  pending: "We have received your order and are preparing it.",
  confirmed: "Your order has been confirmed and payment has been verified.",
  processing: "Your order is being processed at our fulfillment center.",
  on_hold: "Your order is on hold. We'll notify you when it moves forward.",
  packed: "Your items are packed and ready to dispatch.",
  shipped: "Your order has been shipped from our warehouse.",
  on_the_way: "Your package is out for delivery.",
  delivered: "Your order has been delivered successfully.",
  completed: "Your order is complete. Thank you for shopping with us.",
  cancelled: "Your order has been cancelled as requested.",
  refunded: "Your order has been refunded.",
  failed: "There was an issue with your order. Please contact support if you need help.",
};

function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function shippingAddressHtmlBlock(order) {
  const a = order.addressId;
  if (a && typeof a === "object") {
    return `<div style="font-size:14px;color:#27272a;line-height:1.5;"><strong>${a.name || ""}</strong><br/>${a.fullAddress || ""}<br/>${[a.city, a.state].filter(Boolean).join(", ")} ${a.pincode || ""}<br/>Phone: ${a.phone || "—"}</div>`;
  }
  const g = order.guestShipping;
  if (g && typeof g === "object") {
    return `<div style="font-size:14px;color:#27272a;line-height:1.5;"><strong>${g.name || ""}</strong><br/>${g.fullAddress || ""}<br/>${[g.city, g.state].filter(Boolean).join(", ")} ${g.pincode || ""}<br/>Phone: ${g.phone || "—"}</div>`;
  }
  return "<p style='color:#71717a;'>—</p>";
}

function orderItemsHtmlTable(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return "<p style='color:#71717a;'>No line items</p>";
  const rows = items
    .map((item) => {
      const name = item.productName || item.product?.name || "Product";
      const qty = item.quantity ?? 0;
      const price = formatMoney(item.price);
      const line = formatMoney(Number(item.price || 0) * Number(qty || 0));
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px;">${name} × ${qty}</td><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;font-size:14px;">${line}</td></tr>`;
    })
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function trackingBlockHtml(order) {
  if (order.trackingNumber) {
    return `<p style="margin:0;font-size:14px;color:#3f3f46;"><strong>Tracking:</strong> ${order.trackingNumber}<br/><strong>Carrier:</strong> ${order.carrier || "—"}</p>`;
  }
  return `<p style="margin:0;font-size:13px;color:#71717a;">Tracking details will be shared when available.</p>`;
}

/**
 * Build variable map for order-related templates.
 */
function buildOrderTemplateVars(order, extra = {}) {
  const status = extra.status || order.status;
  const s = String(status || "").toLowerCase();
  return {
    storeName: process.env.STORE_NAME || "Zippyyy",
    customerName: getCustomerName(order),
    customerEmail: getCustomerEmail(order) || "—",
    orderId: String(order._id || ""),
    orderNumber: order.orderNumber || String(order._id || ""),
    orderItemsHtml: orderItemsHtmlTable(order),
    totalAmount: formatMoney(order.totalAmount),
    shippingAddressHtml: shippingAddressHtmlBlock(order),
    status: s,
    statusLabel: STATUS_LABELS[s] || status || "Updated",
    statusMessage: STATUS_MESSAGES[s] || "Your order status has been updated.",
    trackingBlockHtml: trackingBlockHtml(order),
    ...extra,
  };
}

function applyVariables(templateStr, vars) {
  if (templateStr == null) return "";
  let out = String(templateStr);
  const re = /\{\{\s*([\w]+)\s*\}\}/g;
  out = out.replace(re, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
  return out;
}

/**
 * Inserts any missing template keys (safe when DB already has older defaults).
 */
async function ensureDefaultTemplates() {
  for (const d of TEMPLATE_DEFAULTS) {
    const exists = await EmailTemplate.findOne({ key: d.key }).lean();
    if (exists) continue;
    await EmailTemplate.create({
      key: d.key,
      name: d.name,
      description: d.description,
      subject: d.subject,
      bodyHtml: d.bodyHtml,
      isActive: true,
    });
  }
}

async function getTemplateByKey(key) {
  await ensureDefaultTemplates();
  let doc = await EmailTemplate.findOne({ key }).lean();
  if (!doc) {
    const def = TEMPLATE_DEFAULTS.find((t) => t.key === key);
    if (!def) return null;
    const created = await EmailTemplate.create({
      key: def.key,
      name: def.name,
      description: def.description,
      subject: def.subject,
      bodyHtml: def.bodyHtml,
      isActive: true,
    });
    doc = created.toObject();
  }
  return doc;
}

async function renderTemplateKey(key, vars) {
  const doc = await getTemplateByKey(key);
  if (!doc || doc.isActive === false) return null;
  return {
    subject: applyVariables(doc.subject, vars),
    html: applyVariables(doc.bodyHtml, vars),
  };
}

function buildContactTemplateVars({ name, email, queryType, subject, message }) {
  return {
    storeName: process.env.STORE_NAME || "Zippyyy",
    contactName: name || "",
    contactEmail: email || "",
    queryType: queryType || "—",
    contactSubject: subject || "",
    contactMessage: String(message || "").replace(/\n/g, "<br/>"),
  };
}

module.exports = {
  ensureDefaultTemplates,
  getTemplateByKey,
  renderTemplateKey,
  applyVariables,
  buildOrderTemplateVars,
  buildContactTemplateVars,
  STATUS_LABELS,
  STATUS_MESSAGES,
  TEMPLATE_DEFAULTS,
};
