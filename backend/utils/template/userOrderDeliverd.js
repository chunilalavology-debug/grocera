const { getCustomerName } = require("../orderEmailUtils");

const OrderDelivered = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsList = items.map(item => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px dashed #eee;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td width="50" valign="top">
                            ${item.productImage ? `<img src="${item.productImage}" alt="${item.productName}" width="45" height="45" style="border-radius: 6px; object-fit: cover;">` : `<div style="width:45px;height:45px;background:#f3f4f6;border-radius:6px;"></div>`}
                        </td>
                        <td style="padding-left: 12px;">
                            <div style="font-weight: 600; color: #333; font-size: 14px;">${item.productName ?? 'Product'}</div>
                            <div style="font-size: 11px; color: #999;">Qty: ${item.quantity}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `).join('');

    return `
    <div style="background-color: #f4f7f6; padding: 40px 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
            
            <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 20px; text-align: center; color: #ffffff;">
                    <div style="font-size: 50px; margin-bottom: 10px;">🎁</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">It's Arrived!</h1>
                    <p style="opacity: 0.9; font-size: 16px; margin-top: 10px;">Your package has been successfully delivered.</p>
                </td>
            </tr>

            <tr>
                <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 25px 0; font-size: 16px; color: #444; line-height: 1.6; text-align: center;">
                        Hi <strong>${getCustomerName(order)}</strong>, we hope you're excited! Your order <strong>#${order.orderNumber}</strong> was dropped off today.
                    </p>

                    <div style="background-color: #f8f9ff; border: 1px solid #e0e4ff; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 35px;">
                        <h3 style="margin: 0 0 10px 0; color: #4b3f94; font-size: 18px;">How did we do?</h3>
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Your feedback helps us improve.</p>
                        <a href="https://zippyyy.com/orders" style="background-color: #764ba2; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block;">Rate Products</a>
                    </div>

                    <h4 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 15px;">Delivered Items</h4>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                        ${itemsList}
                    </table>

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #eee; padding-top: 20px;">
                        <tr>
                            <td>
                                <p style="font-size: 13px; color: #888; margin: 0; line-height: 1.5;">
                                    <strong>Not what you expected?</strong><br>
                                    No worries! You can request a return within 7 days through our app or website.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #eee;">
                    <p style="color: #555; font-size: 14px; margin-bottom: 15px; font-weight: 600;">Thank you for shopping with Zippyyy!</p>
                    <div style="margin-bottom: 20px;">
                        <a href="#" style="margin: 0 10px; text-decoration: none; color: #764ba2; font-size: 12px;">Help Center</a>
                        <a href="#" style="margin: 0 10px; text-decoration: none; color: #764ba2; font-size: 12px;">Privacy Policy</a>
                    </div>
                    <p style="color: #bbb; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} Zippyyy Inc. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </div>`;
}

module.exports = OrderDelivered;