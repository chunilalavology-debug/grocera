const formatStatusLabel = (status) => {
  const map = {
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
  return map[status] || String(status || "Updated");
};

const statusIntro = (status) => {
  const map = {
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
  return map[status] || "Your order status has been updated.";
};

const { getCustomerName } = require("../orderEmailUtils");

const userOrderStatusUpdate = (order, status) => {
  const safeItems = Array.isArray(order?.items) ? order.items : [];
  const itemsList = safeItems
    .slice(0, 6)
    .map((item) => {
      const name = item?.productName || "Product";
      const qty = Number(item?.quantity || 0);
      const price = Number(item?.price || 0).toFixed(2);
      return `
        <tr>
          <td style="padding:8px 0;color:#334155;font-size:14px;">${name} x ${qty}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;text-align:right;">$${price}</td>
        </tr>
      `;
    })
    .join("");

  const trackingRow = order?.trackingNumber
    ? `
      <p style="margin:0 0 6px 0;font-size:14px;color:#334155;">
        <strong>Tracking Number:</strong> ${order.trackingNumber}
      </p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#334155;">
        <strong>Carrier:</strong> ${order?.carrier || "Shipping partner"}
      </p>
    `
    : `<p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">Tracking details will be shared once available.</p>`;

  return `
  <div style="background:#f8fafc;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:22px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
          <h2 style="margin:0;color:#0f172a;font-size:22px;">Order ${formatStatusLabel(status)}</h2>
          <p style="margin:8px 0 0 0;color:#334155;font-size:14px;">Order #${order?.orderNumber || "-"}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px;">
          <p style="margin:0 0 12px 0;color:#0f172a;font-size:15px;">Hi ${getCustomerName(order)},</p>
          <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6;">${statusIntro(status)}</p>
          ${trackingRow}
          <div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemsList || '<tr><td style="color:#64748b;font-size:13px;">No line items available</td></tr>'}
              <tr>
                <td style="padding-top:10px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700;">Total</td>
                <td style="padding-top:10px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700;text-align:right;">$${Number(order?.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Track your order anytime from your account orders page.</p>
        </td>
      </tr>
    </table>
  </div>`;
};

module.exports = userOrderStatusUpdate;
