const { getCustomerName } = require("../orderEmailUtils");

const OrderCancelled = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsList = items.map(item => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td width="50" valign="top">
                            <img src="${item.productImage}" alt="${item.productName}" width="45" height="45" style="border-radius: 4px; filter: grayscale(100%); opacity: 0.6; border: 1px solid #eee;">
                        </td>
                        <td style="padding-left: 12px;">
                            <div style="font-weight: 600; color: #555; font-size: 14px;">${item.productName ?? 'Product'}</div>
                            <div style="font-size: 12px; color: #999;">Quantity: ${item.quantity}</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; color: #888; font-size: 14px; vertical-align: top;">
                $${item.price.toFixed(2)}
            </td>
        </tr>
    `).join('');

    return `
    <div style="background-color: #fcfcfc; padding: 40px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eee;">
            
            <tr>
                <td style="background-color: #fff5f5; padding: 40px 20px; text-align: center; border-bottom: 1px solid #ffebeb;">
                    <div style="background-color: #dc3545; color: #ffffff; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; font-size: 30px; margin: 0 auto 15px auto;">✕</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 26px; letter-spacing: -0.5px;">Order Cancelled</h1>
                    <p style="color: #666; font-size: 16px; margin-top: 8px;">Hi ${getCustomerName(order)}, your order has been successfully cancelled.</p>
                </td>
            </tr>

            <tr>
                <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; font-size: 15px; color: #444; line-height: 1.6;">
                        This is to confirm that your order <strong>#${order.orderNumber}</strong> has been cancelled. If any payment was made, the refund will be processed to your original payment method within 5-7 business days.
                    </p>

                    <h4 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Cancelled Items</h4>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                        ${itemsList}
                    </table>

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ddd;">
                        <tr>
                            <td style="font-size: 14px; color: #777;">Refund Amount</td>
                            <td align="right" style="font-size: 18px; font-weight: bold; color: #444;">$${order.totalAmount.toFixed(2)}</td>
                        </tr>
                    </table>

                    <div style="margin-top: 30px; padding: 20px; background-color: #fffbe6; border-radius: 8px; border: 1px solid #ffe58f;">
                        <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.5;">
                            <strong>Need help?</strong> If you didn't request this cancellation or have any questions about your refund, please contact our support team immediately.
                        </p>
                    </div>
                </td>
            </tr>

            <tr>
                <td style="padding: 30px; background-color: #f4f4f4; text-align: center;">
                    <div style="margin-bottom: 15px;">
                        <a href="https://zippyyy.com" style="background-color: #1a1a1a; color: #ffffff; padding: 12px 25px; text-decoration: none; font-size: 13px; font-weight: bold; border-radius: 4px; display: inline-block;">Continue Shopping</a>
                    </div>
                    <p style="color: #999; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} Zippyyy. We hope to see you again soon.</p>
                </td>
            </tr>
        </table>
    </div>`;
}

module.exports = OrderCancelled;