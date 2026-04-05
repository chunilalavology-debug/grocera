/**
 * Default seed content when DB templates are missing.
 * Variables: {{customerName}}, {{orderNumber}}, {{orderId}}, {{orderItemsHtml}}, {{totalAmount}},
 * {{shippingAddressHtml}}, {{status}}, {{statusLabel}}, {{statusMessage}}, {{trackingBlockHtml}},
 * {{storeName}}, {{contactName}}, {{contactEmail}}, {{queryType}}, {{contactSubject}}, {{contactMessage}}
 */

const wrap = (inner) => `
<div style="font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e4e4e7;overflow:hidden;">
    <tr><td style="padding:20px 24px;background:#0f172a;color:#fafafa;font-size:18px;font-weight:700;">{{storeName}}</td></tr>
    <tr><td style="padding:24px;">${inner}</td></tr>
    <tr><td style="padding:16px 24px;background:#fafafa;font-size:11px;color:#71717a;">&copy; {{storeName}}</td></tr>
  </table>
</div>`;

module.exports.TEMPLATE_DEFAULTS = [
  {
    key: "order_customer_new",
    name: "New order (customer)",
    description: "Sent to the customer when an order is placed and paid.",
    subject: "Order confirmation – #{{orderNumber}}",
    bodyHtml: wrap(`
      <p style="margin:0 0 12px;font-size:16px;color:#18181b;">Hi {{customerName}},</p>
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">Thank you for your order <strong>#{{orderNumber}}</strong>.</p>
      <div style="margin:16px 0;">{{orderItemsHtml}}</div>
      <p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#008060;">Total: {{totalAmount}}</p>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e4e4e7;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;">Delivery</p>{{shippingAddressHtml}}</div>
    `),
  },
  {
    key: "order_admin_new",
    name: "New order (admin)",
    description: "Alert sent to the admin inbox for new orders.",
    subject: "New order – #{{orderNumber}}",
    bodyHtml: wrap(`
      <p style="margin:0 0 12px;font-size:15px;color:#18181b;">New order <strong>#{{orderNumber}}</strong></p>
      <p style="margin:0 0 8px;font-size:13px;color:#52525b;"><strong>Customer:</strong> {{customerName}} &lt;{{customerEmail}}&gt;</p>
      <div style="margin:16px 0;">{{orderItemsHtml}}</div>
      <p style="margin:0;font-size:18px;font-weight:700;">Total: {{totalAmount}}</p>
      <div style="margin-top:16px;">{{shippingAddressHtml}}</div>
    `),
  },
  {
    key: "order_status_update",
    name: "Order status update",
    description: "Generic status change (processing, shipped, on hold, etc.).",
    subject: "Order update – #{{orderNumber}} ({{statusLabel}})",
    bodyHtml: wrap(`
      <p style="margin:0 0 8px;font-size:16px;color:#18181b;">Hi {{customerName}},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">{{statusMessage}}</p>
      <p style="margin:0 0 8px;font-size:13px;"><strong>Status:</strong> {{statusLabel}}</p>
      <div style="margin:12px 0;">{{trackingBlockHtml}}</div>
      <div style="margin-top:12px;">{{orderItemsHtml}}</div>
      <p style="margin:16px 0 0;font-size:14px;font-weight:600;">Total: {{totalAmount}}</p>
    `),
  },
  {
    key: "order_completed",
    name: "Order completed / delivered",
    description: "When order is marked delivered or completed.",
    subject: "Your order has arrived – #{{orderNumber}}",
    bodyHtml: wrap(`
      <p style="margin:0 0 12px;font-size:16px;color:#18181b;">Hi {{customerName}},</p>
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">Your order <strong>#{{orderNumber}}</strong> has been delivered. We hope you enjoy your purchase!</p>
      <div style="margin:12px 0;">{{orderItemsHtml}}</div>
      <p style="margin:16px 0 0;font-size:14px;">Total paid: <strong>{{totalAmount}}</strong></p>
    `),
  },
  {
    key: "order_cancelled",
    name: "Order cancelled",
    description: "When an order is cancelled.",
    subject: "Order cancelled – #{{orderNumber}}",
    bodyHtml: wrap(`
      <p style="margin:0 0 12px;font-size:16px;color:#18181b;">Hi {{customerName}},</p>
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">Your order <strong>#{{orderNumber}}</strong> has been cancelled. If you were charged, a refund will be processed according to our policy.</p>
      <div style="margin:12px 0;">{{orderItemsHtml}}</div>
    `),
  },
  {
    key: "contact_form_admin",
    name: "Contact form (admin)",
    description: "Notification when someone submits the storefront contact form.",
    subject: "Contact: {{contactSubject}}",
    bodyHtml: `
<div style="font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e4e4e7;">
    <tr><td style="padding:20px 24px;background:#18181b;color:#fafafa;font-weight:700;">Contact form — {{storeName}}</td></tr>
    <tr><td style="padding:24px;font-size:14px;color:#3f3f46;line-height:1.6;">
      <p><strong>Name:</strong> {{contactName}}</p>
      <p><strong>Email:</strong> {{contactEmail}}</p>
      <p><strong>Topic:</strong> {{queryType}}</p>
      <p><strong>Subject:</strong> {{contactSubject}}</p>
      <div style="margin-top:16px;padding:12px;background:#fafafa;border-radius:8px;">{{contactMessage}}</div>
    </td></tr>
  </table>
</div>`,
  },
];

/** Same body as generic status email; one DB row per status so admins can customize copy per step. */
const ORDER_STATUS_EMAIL_INNER = `
      <p style="margin:0 0 8px;font-size:16px;color:#18181b;">Hi {{customerName}},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">{{statusMessage}}</p>
      <p style="margin:0 0 8px;font-size:13px;"><strong>Status:</strong> {{statusLabel}}</p>
      <div style="margin:12px 0;">{{trackingBlockHtml}}</div>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;">Order <strong>#{{orderNumber}}</strong></p>
      <div style="margin-top:12px;">{{orderItemsHtml}}</div>
      <p style="margin:16px 0 0;font-size:14px;font-weight:600;">Total: {{totalAmount}}</p>
`;

const ORDER_STATUS_TEMPLATE_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  on_hold: "On hold",
  packed: "Packed",
  shipped: "Shipped",
  on_the_way: "On the way",
  refunded: "Refunded",
  failed: "Failed",
};

const PER_ORDER_STATUS_TEMPLATE_KEYS = Object.keys(ORDER_STATUS_TEMPLATE_LABELS);

for (const s of PER_ORDER_STATUS_TEMPLATE_KEYS) {
  const label = ORDER_STATUS_TEMPLATE_LABELS[s];
  module.exports.TEMPLATE_DEFAULTS.push({
    key: `order_status_${s}`,
    name: `Order: ${label}`,
    description: `Customer email when order status is set to “${label}”. Falls back to “Order status update” if disabled. Variables: {{customerName}}, {{orderNumber}}, {{statusMessage}}, {{orderItemsHtml}}, {{totalAmount}}, etc.`,
    subject: "Order update – #{{orderNumber}} ({{statusLabel}})",
    bodyHtml: wrap(ORDER_STATUS_EMAIL_INNER),
  });
}
