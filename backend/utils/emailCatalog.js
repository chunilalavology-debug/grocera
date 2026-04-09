const { listAllTemplateKeys } = require("./emailTemplateDefaults");
const { ORDER_STATUSES } = require("./orderStatuses");

const VARIABLE_HELP = {
  order:
    "{{customerName}} {{userName}} {{orderNumber}} {{orderId}} {{orderItemsHtml}} {{totalAmount}} {{shippingAddressHtml}} {{status}} {{statusLabel}} {{statusMessage}} {{trackingBlockHtml}} {{paymentMethod}} {{paymentBreakdown}} {{storeName}} {{storeLogoUrl}} {{supportEmail}} {{currentYear}}",
  contact:
    "{{contactName}} {{contactEmail}} {{queryType}} {{contactSubject}} {{contactMessage}} {{storeName}} {{storeLogoUrl}} {{supportEmail}} {{currentYear}}",
  auth: "{{userName}} {{resetLink}} {{storeName}} {{storeLogoUrl}} {{supportEmail}} {{currentYear}}",
  message:
    "{{contactName}} {{adminReplyHtml}} {{originalThreadHtml}} {{storeName}} {{storeLogoUrl}} {{supportEmail}} {{currentYear}}",
};

/**
 * Admin UI + API: one row per logical notification.
 */
function buildEmailCatalog() {
  const rows = [
    {
      id: "orderConfirmationUser",
      category: "Orders",
      label: "Order confirmation (customer)",
      description: "Sent when a grocery order is paid (non–shipping-only flow).",
      templateKey: "order_customer_new",
      toggleKey: "orderConfirmationUser",
      variables: VARIABLE_HELP.order,
    },
    {
      id: "adminNewOrder",
      category: "Orders",
      label: "New order (admin)",
      description: "Alert to your admin inbox. Uses OTC template automatically when relevant.",
      templateKeys: ["order_admin_new", "order_admin_otc"],
      toggleKey: "adminNewOrder",
      variables: VARIABLE_HELP.order,
    },
    {
      id: "contactFormAdmin",
      category: "Contact",
      label: "Contact form (admin)",
      description: "Notification when a customer submits the storefront contact form.",
      templateKey: "contact_form_admin",
      toggleKey: "contactFormAdmin",
      variables: VARIABLE_HELP.contact,
    },
    {
      id: "contactFormCustomerAck",
      category: "Contact",
      label: "Contact form (customer acknowledgement)",
      description: "Automatic email to the customer after they submit the contact form.",
      templateKey: "contact_customer_ack",
      toggleKey: "contactFormCustomerAck",
      variables: VARIABLE_HELP.contact,
    },
    {
      id: "messageAdminReply",
      category: "Messages",
      label: "Admin reply (customer)",
      description: "Sent when you reply to a message from the admin dashboard.",
      templateKey: "message_admin_reply",
      toggleKey: "messageAdminReply",
      variables: VARIABLE_HELP.message,
    },
    {
      id: "passwordReset",
      category: "Account",
      label: "Password reset",
      description: "Forgot-password email with secure reset link.",
      templateKey: "auth_password_reset",
      toggleKey: "passwordReset",
      variables: VARIABLE_HELP.auth,
    },
  ];

  const statusList = ORDER_STATUSES.filter((s) => s !== "session");
  for (const s of statusList) {
    const label = s.replace(/_/g, " ");
    rows.push({
      id: `orderStatus:${s}`,
      category: "Order status",
      label: `Status: ${label}`,
      description: `Customer email when an order moves to “${label}”.`,
      templateKey: `order_status_${s}`,
      /** Maps to AppSettings.emailNotifications.orderStatusEmail[status] and send gate emailType orderStatus:${s} */
      orderStatusKey: s,
      variables: VARIABLE_HELP.order,
    });
  }

  rows.push({
    id: "orderStatusFallback",
    category: "Order status",
    label: "Generic status template (fallback)",
    description: "Used if a specific status template is inactive or missing.",
    templateKey: "order_status_update",
    toggleKey: null,
    variables: VARIABLE_HELP.order,
  });

  rows.push({
    id: "orderDeliveredVariant",
    category: "Order status",
    label: "Delivered / completed (extra template)",
    description: "Optional richer copy; tried after per-status templates for delivered & completed.",
    templateKey: "order_completed",
    toggleKey: null,
    variables: VARIABLE_HELP.order,
  });

  rows.push({
    id: "orderCancelledVariant",
    category: "Order status",
    label: "Cancelled (extra template)",
    description: "Optional; tried after order_status_cancelled when applicable.",
    templateKey: "order_cancelled",
    toggleKey: null,
    variables: VARIABLE_HELP.order,
  });

  return {
    rows,
    templateKeys: listAllTemplateKeys(),
  };
}

module.exports = { buildEmailCatalog, VARIABLE_HELP };
