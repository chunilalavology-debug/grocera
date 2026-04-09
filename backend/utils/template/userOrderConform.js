const { getCustomerName } = require("../orderEmailUtils");

function deliveryBlock(order) {
  const a = order.addressId;
  if (a && typeof a === "object" && (a.fullAddress || a.name)) {
    return `
      <strong>${a.name || getCustomerName(order)}</strong><br>
      ${a.fullAddress || ""}<br>
      ${[a.city, a.state].filter(Boolean).join(", ")} ${a.pincode || ""}<br>
      <span style="color: #888;">Phone: ${a.phone || "—"}</span>
    `;
  }
  const g = order.guestShipping;
  if (g && typeof g === "object") {
    return `
      <strong>${g.name || getCustomerName(order)}</strong><br>
      ${g.fullAddress || ""}<br>
      ${[g.city, g.state].filter(Boolean).join(", ")} ${g.pincode || ""}<br>
      <span style="color: #888;">Phone: ${g.phone || "—"}</span>
      ${g.email ? `<br><span style="color: #888;">Email: ${g.email}</span>` : ""}
    `;
  }
  return "<span style='color:#888;'>Address on file</span>";
}

const OrderConform = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsList = items
    .map((item) => {
      const img = item.productImage || "";
      const name = item.productName ?? "Product";
      const qty = item.quantity ?? 0;
      const price = Number(item.price || 0);
      return `
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td width="60" valign="top">
                            ${img ? `<img src="${img}" alt="${name}" width="50" height="50" style="border-radius: 4px; object-fit: cover; border: 1px solid #eee;">` : `<div style="width:50px;height:50px;background:#f3f4f6;border-radius:4px;"></div>`}
                        </td>
                        <td style="padding-left: 15px;">
                            <div style="font-weight: 600; color: #222; font-size: 15px;">${name}</div>
                            <div style="font-size: 12px; color: #777; margin-top: 2px;">Quantity: ${qty}</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #222; vertical-align: top;">
                $${price.toFixed(2)}
            </td>
        </tr>`;
    })
    .join("");

  const sub = Number(order.subtotal ?? 0);
  const ship = Number(order.shippingAmount ?? 0);
  const tax = Number(order.taxAmount ?? 0);
  const total = Number(order.totalAmount ?? 0);
  const cname = getCustomerName(order);

  return `
    <div style="background-color: #f9f9f9; padding: 40px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <tr>
                <td style="background-color: #f8fafc; padding: 32px 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                    <div style="background-color: #008060; color: #ffffff; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; font-size: 26px; margin: 0 auto 12px auto;">✓</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 26px; letter-spacing: -0.5px;">Order confirmed</h1>
                    <p style="color: #666; font-size: 16px; margin-top: 8px;">Hi ${cname}, thank you for your order.</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; font-size: 15px; color: #444; line-height: 1.6;">
                        We've received order <strong>#${order.orderNumber}</strong>. You'll get another email when the status changes.
                    </p>
                    <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Order summary</h4>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                        ${itemsList}
                    </table>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fbfbfb; padding: 20px; border-radius: 8px;">
                        <tr>
                            <td style="font-size: 14px; color: #666; padding-bottom: 8px;">Subtotal</td>
                            <td align="right" style="font-size: 14px; color: #222; padding-bottom: 8px;">$${sub.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px; color: #666; padding-bottom: 8px;">Tax</td>
                            <td align="right" style="font-size: 14px; color: #222; padding-bottom: 8px;">$${tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px; color: #666; padding-bottom: 15px;">Shipping</td>
                            <td align="right" style="font-size: 14px; color: #222; padding-bottom: 15px;">$${ship.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 16px; font-weight: bold; color: #1a1a1a; border-top: 1px solid #ddd; padding-top: 15px;">Total</td>
                            <td align="right" style="font-size: 20px; font-weight: bold; color: #008060; border-top: 1px solid #ddd; padding-top: 15px;">$${total.toFixed(2)}</td>
                        </tr>
                    </table>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                        <tr>
                            <td style="vertical-align: top;">
                                <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 10px;">Delivery</h4>
                                <div style="font-size: 14px; color: #444; line-height: 1.5;">
                                    ${deliveryBlock(order)}
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; background-color: #0f172a; text-align: center;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} Zippyyy</p>
                </td>
            </tr>
        </table>
    </div>`;
};

module.exports = OrderConform;
