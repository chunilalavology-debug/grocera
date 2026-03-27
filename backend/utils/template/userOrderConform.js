const OrderConform = (order) => {
    const itemsList = order.items.map(item => `
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td width="60" valign="top">
                            <img src="${item.productImage}" alt="${item.productName}" width="50" height="50" style="border-radius: 4px; object-fit: cover; border: 1px solid #eee;">
                        </td>
                        <td style="padding-left: 15px;">
                            <div style="font-weight: 600; color: #222; font-size: 15px;">${item.productName ?? 'Product'}</div>
                            <div style="font-size: 12px; color: #777; margin-top: 2px;">Quantity: ${item.quantity}</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #222; vertical-align: top;">
                $${item.price.toFixed(2)}
            </td>
        </tr>
    `).join('');

    return `
    <div style="background-color: #f9f9f9; padding: 40px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            
            <tr>
                <td style="background-color: #f8fff9; padding: 40px 20px; text-align: center; border-bottom: 1px solid #eef5ee;">
                    <div style="background-color: #28a745; color: #ffffff; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; font-size: 30px; margin: 0 auto 15px auto;">✓</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 26px; letter-spacing: -0.5px;">Order Confirmed!</h1>
                    <p style="color: #666; font-size: 16px; margin-top: 8px;">Hi ${order.userId?.name}, your order is on its way.</p>
                </td>
            </tr>

            <tr>
                <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; font-size: 15px; color: #444; line-height: 1.6;">
                        Great news! We've received your order <strong>#${order.orderNumber}</strong> and our team is already working on it.
                    </p>

                    <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Order Summary</h4>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                        ${itemsList}
                    </table>

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fbfbfb; padding: 20px; border-radius: 8px;">
                        <tr>
                            <td style="font-size: 14px; color: #666; padding-bottom: 8px;">Subtotal</td>
                            <td align="right" style="font-size: 14px; color: #222; padding-bottom: 8px;">$${(order.totalAmount - 5).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px; color: #666; padding-bottom: 15px;">Shipping</td>
                            <td align="right" style="font-size: 14px; color: #222; padding-bottom: 15px;">$5.00</td>
                        </tr>
                        <tr>
                            <td style="font-size: 16px; font-weight: bold; color: #1a1a1a; border-top: 1px solid #ddd; padding-top: 15px;">Total Amount</td>
                            <td align="right" style="font-size: 20px; font-weight: bold; color: #28a745; border-top: 1px solid #ddd; padding-top: 15px;">$${order.totalAmount.toFixed(2)}</td>
                        </tr>
                    </table>

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                        <tr>
                            <td style="vertical-align: top;">
                                <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 10px;">Delivery Address</h4>
                                <div style="font-size: 14px; color: #444; line-height: 1.5;">
                                    <strong>${order.addressId?.name || order.userId?.name}</strong><br>
                                    ${order.addressId?.fullAddress}<br>
                                    ${order.addressId?.city}, ${order.addressId?.state} ${order.addressId?.pincode}<br>
                                    <span style="color: #888;">Phone: ${order.addressId?.phone}</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding: 30px; background-color: #1a1a1a; text-align: center;">
                    <div style="margin-bottom: 15px;">
                        <a href="https://zippyyy.com/orders" style="background-color: #ffffff; color: #1a1a1a; padding: 12px 25px; text-decoration: none; font-size: 13px; font-weight: bold; border-radius: 4px; display: inline-block;">Track My Order</a>
                    </div>
                    <p style="color: #888; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} Zippyyy. Quality products delivered to your door.</p>
                </td>
            </tr>
        </table>
    </div>`;
}

module.exports = OrderConform;