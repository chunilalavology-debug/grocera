const { getCustomerName, getCustomerEmail } = require("../orderEmailUtils");

function shippingHtml(order) {
  const a = order.addressId;
  if (a && typeof a === "object") {
    return `
      ${a.fullAddress || ""}<br>
      ${[a.city, a.state].filter(Boolean).join(", ")} ${a.pincode || ""}<br>
      <strong>Tel:</strong> ${a.phone || "—"}
    `;
  }
  const g = order.guestShipping;
  if (g && typeof g === "object") {
    return `
      ${g.fullAddress || ""}<br>
      ${[g.city, g.state].filter(Boolean).join(", ")} ${g.pincode || ""}<br>
      <strong>Tel:</strong> ${g.phone || "—"}
    `;
  }
  return "—";
}

const AdminAlert = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items
    .map((item) => {
      const sub = Number(item.subtotal != null ? item.subtotal : (item.price || 0) * (item.quantity || 0));
      return `
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0;">
                <div style="font-weight: 600; color: #222; font-size: 15px;">${item.productName || "Product"}</div>
                <div style="font-size: 12px; color: #888;">SKU: ${item.productSku || "N/A"}</div>
            </td>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0; text-align: center; color: #444;">${item.quantity}</td>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0; text-align: right; color: #222; font-weight: 600;">$${sub.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const cname = getCustomerName(order);
  const cemail = getCustomerEmail(order) || "—";

  return `
    <div style="background-color: #f4f4f4; padding: 40px 10px; font-family: Georgia, serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #d4d4d4; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                    <div style="height:36px;width:120px;margin:0 auto 12px;background:#e5e5e5;border-radius:6px;line-height:36px;font-size:10px;color:#737373;">LOGO</div>
                    <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; letter-spacing: 0.5px;">New order</h1>
                    <div style="width: 50px; height: 2px; background: #008060; margin: 15px auto;"></div>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #666; margin-top: 10px;">Order <strong>#${order.orderNumber}</strong></p>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 40px 20px 40px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #444;">
                        <tr>
                            <td width="50%" valign="top" style="padding-right: 10px;">
                                <h4 style="margin-bottom: 10px; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 5px;">CUSTOMER</h4>
                                <strong>${cname}</strong><br>
                                ${cemail}
                            </td>
                            <td width="50%" valign="top" style="padding-left: 10px;">
                                <h4 style="margin-bottom: 10px; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 5px;">SHIPPING</h4>
                                ${shippingHtml(order)}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 40px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px;">
                        <thead>
                            <tr style="color: #888; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">
                                <th align="left" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Item</th>
                                <th align="center" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Qty</th>
                                <th align="right" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px 40px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="right" style="font-family: Arial, sans-serif; font-size: 16px; color: #1a1a1a;">
                                <span>Total:</span>
                                <span style="font-size: 22px; font-weight: bold; margin-left: 10px; color:#008060;">$${Number(order.totalAmount || 0).toFixed(2)}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="background-color: #fbfbfb; padding: 20px 40px; text-align: center; border-top: 1px solid #eee;">
                    <p style="font-family: Arial, sans-serif; font-size: 11px; color: #999; margin: 0;">
                        &copy; ${new Date().getFullYear()} Zippyyy Admin
                    </p>
                </td>
            </tr>
        </table>
    </div>`;
};

module.exports = AdminAlert;
