/**
 * Default seed content when DB templates are missing.
 * Body fragments are wrapped at send-time by utils/emailShell.js (store logo + footer).
 *
 * Variables: {{customerName}} {{userName}} {{orderNumber}} {{orderId}} {{orderItemsHtml}} {{totalAmount}}
 * {{shippingAddressHtml}} {{status}} {{statusLabel}} {{statusMessage}} {{trackingBlockHtml}}
 * {{storeName}} {{storeLogoUrl}} {{supportEmail}} {{currentYear}}
 * {{contactName}} {{contactEmail}} {{queryType}} {{contactSubject}} {{contactMessage}}
 * {{paymentMethod}} {{stripeAmount}} {{otcAmount}} {{paymentBreakdown}}
 * {{resetLink}} (password reset)
 * {{adminReplyHtml}} {{originalThreadHtml}} (message reply)
 */

const ORDER_STATUS_EMAIL_INNER = `
<p style="margin:0 0 8px;font-size:16px;color:#0f172a;">Hi {{customerName}},</p>
<p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6;">{{statusMessage}}</p>
<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>Status:</strong> {{statusLabel}}</p>
<div style="margin:12px 0;">{{trackingBlockHtml}}</div>
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#334155;">Order <strong>#{{orderNumber}}</strong></p>
<div style="margin-top:12px;">{{orderItemsHtml}}</div>
<p style="margin:16px 0 0;font-size:14px;font-weight:600;color:#0f172a;">Total: {{totalAmount}}</p>
`;

const ORDER_STATUS_TEMPLATE_LABELS = {
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

const BASE_DEFAULTS = [
  {
    key: "order_customer_new",
    name: "Order confirmation (customer)",
    description: "Sent to the customer when a grocery order is placed and paid.",
    subject: "Order confirmation – #{{orderNumber}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{customerName}},</p>
<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Thank you for your order <strong>#{{orderNumber}}</strong>.</p>
<div style="margin:16px 0;">{{orderItemsHtml}}</div>
<p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#0f766e;">Total: {{totalAmount}}</p>
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Delivery</p>
  {{shippingAddressHtml}}
</div>`,
  },
  {
    key: "order_admin_new",
    name: "New order (admin)",
    description: "Alert to the admin inbox for new card-paid orders.",
    subject: "New order – #{{orderNumber}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:15px;color:#0f172a;">New order <strong>#{{orderNumber}}</strong></p>
<p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Customer:</strong> {{customerName}} &lt;{{customerEmail}}&gt;</p>
<div style="margin:16px 0;">{{orderItemsHtml}}</div>
<p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Total: {{totalAmount}}</p>
<div style="margin-top:16px;">{{shippingAddressHtml}}</div>`,
  },
  {
    key: "order_admin_otc",
    name: "New OTC / split order (admin)",
    description: "Alert for OTC or split checkout orders.",
    subject: "OTC order alert – #{{orderNumber}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:15px;color:#0f172a;">New OTC/split order <strong>#{{orderNumber}}</strong></p>
<p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Customer:</strong> {{customerName}} &lt;{{customerEmail}}&gt;</p>
<p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Payment method:</strong> {{paymentMethod}}</p>
<p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Breakdown:</strong> {{paymentBreakdown}}</p>
<div style="margin:16px 0;">{{orderItemsHtml}}</div>
<p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Total: {{totalAmount}}</p>
<div style="margin-top:16px;">{{shippingAddressHtml}}</div>`,
  },
  {
    key: "order_status_update",
    name: "Order status (generic fallback)",
    description: "Used when no specific status template matches.",
    subject: "Order update – #{{orderNumber}} ({{statusLabel}})",
    bodyHtml: ORDER_STATUS_EMAIL_INNER,
  },
  {
    key: "order_completed",
    name: "Order delivered / completed",
    description: "Optional specialized copy when status is delivered or completed.",
    subject: "Your order has arrived – #{{orderNumber}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{customerName}},</p>
<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Your order <strong>#{{orderNumber}}</strong> has been delivered. We hope you enjoy your purchase!</p>
<div style="margin:12px 0;">{{orderItemsHtml}}</div>
<p style="margin:16px 0 0;font-size:14px;color:#334155;">Total paid: <strong>{{totalAmount}}</strong></p>`,
  },
  {
    key: "order_cancelled",
    name: "Order cancelled",
    description: "When an order is cancelled.",
    subject: "Order cancelled – #{{orderNumber}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{customerName}},</p>
<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Your order <strong>#{{orderNumber}}</strong> has been cancelled. If you were charged, a refund will be processed according to our policy.</p>
<div style="margin:12px 0;">{{orderItemsHtml}}</div>`,
  },
  {
    key: "contact_form_admin",
    name: "Contact form (admin)",
    description: "Inbox notification when someone uses the storefront contact form.",
    subject: "Contact: {{contactSubject}}",
    bodyHtml: `
<p style="margin:0 0 10px;font-size:14px;color:#334155;"><strong>Name:</strong> {{contactName}}</p>
<p style="margin:0 0 10px;font-size:14px;color:#334155;"><strong>Email:</strong> {{contactEmail}}</p>
<p style="margin:0 0 10px;font-size:14px;color:#334155;"><strong>Topic:</strong> {{queryType}}</p>
<p style="margin:0 0 14px;font-size:14px;color:#334155;"><strong>Subject:</strong> {{contactSubject}}</p>
<div style="padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:14px;color:#475569;line-height:1.6;">{{contactMessage}}</div>`,
  },
  {
    key: "contact_customer_ack",
    name: "Contact form (customer thank-you)",
    description: "Automatic acknowledgement email to the customer after they submit the contact form.",
    subject: "We received your message – {{storeName}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{contactName}},</p>
<p style="margin:0 0 14px;font-size:14px;color:#475569;line-height:1.6;">Thanks for contacting <strong>{{storeName}}</strong>. We have received your message and will get back to you shortly.</p>
<p style="margin:0;font-size:13px;color:#64748b;">Your subject: <em>{{contactSubject}}</em></p>`,
  },
  {
    key: "auth_password_reset",
    name: "Password reset",
    description: "Reset link email for forgotten password.",
    subject: "Reset your {{storeName}} password",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{userName}},</p>
<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one.</p>
<p style="margin:0 0 20px;">
  <a href="{{resetLink}}" style="display:inline-block;padding:12px 22px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Reset password</a>
</p>
<p style="margin:0;font-size:12px;color:#94a3b8;">If you did not request this, you can ignore this email.</p>`,
  },
  {
    key: "message_admin_reply",
    name: "Admin reply to contact thread",
    description: "Sent when an admin replies from the dashboard messages area.",
    subject: "Re: your message to {{storeName}}",
    bodyHtml: `
<p style="margin:0 0 12px;font-size:16px;color:#0f172a;">Hi {{contactName}},</p>
<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">Thank you for reaching out. Here is our reply:</p>
<div style="margin:0 0 18px;padding:14px;border-left:4px solid #0f766e;background:#f8fafc;border-radius:0 8px 8px 0;font-size:14px;color:#334155;line-height:1.6;">{{adminReplyHtml}}</div>
<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Your original message</p>
<div style="padding:12px;background:#f1f5f9;border-radius:8px;font-size:13px;color:#475569;">{{originalThreadHtml}}</div>`,
  },
];

module.exports.TEMPLATE_DEFAULTS = [...BASE_DEFAULTS];

for (const s of Object.keys(ORDER_STATUS_TEMPLATE_LABELS)) {
  const label = ORDER_STATUS_TEMPLATE_LABELS[s];
  module.exports.TEMPLATE_DEFAULTS.push({
    key: `order_status_${s}`,
    name: `Order status: ${label}`,
    description: `Customer email when order status becomes “${label}”. Falls back to generic “Order status” template.`,
    subject: "Order update – #{{orderNumber}} ({{statusLabel}})",
    bodyHtml: ORDER_STATUS_EMAIL_INNER,
  });
}

module.exports.ORDER_STATUS_TEMPLATE_LABELS = ORDER_STATUS_TEMPLATE_LABELS;

module.exports.listAllTemplateKeys = function listAllTemplateKeys() {
  return module.exports.TEMPLATE_DEFAULTS.map((t) => t.key);
};
