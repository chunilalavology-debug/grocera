const AdminAlert = (order) => {
    const itemsHtml = order.items.map(item => `
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0;">
                <div style="font-weight: 600; color: #222; font-size: 15px;">${item.productName}</div>
                <div style="font-size: 12px; color: #888;">SKU: ${item.productSku || 'N/A'} | Weight: ${item.selectedWeight || 'N/A'}g</div>
            </td>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0; text-align: center; color: #444;">${item.quantity}</td>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0; text-align: right; color: #222; font-weight: 600;">$${item.subtotal.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <div style="background-color: #f4f4f4; padding: 40px 10px; font-family: 'Georgia', serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #d4d4d4; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            
            <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">New Order Alert</h1>
                    <div style="width: 50px; height: 2px; background: #d9534f; margin: 15px auto;"></div>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #666; margin-top: 10px;">Order Reference: <strong>#${order.orderNumber}</strong></p>
                </td>
            </tr>

            <tr>
                <td style="padding: 0 40px 20px 40px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #444;">
                        <tr>
                            <td width="50%" valign="top" style="padding-right: 10px;">
                                <h4 style="margin-bottom: 10px; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 5px;">CUSTOMER</h4>
                                <strong>${order.userId?.name}</strong><br>
                                ${order.userId?.email}
                            </td>
                            <td width="50%" valign="top" style="padding-left: 10px;">
                                <h4 style="margin-bottom: 10px; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 5px;">SHIPPING ADDRESS</h4>
                                ${order.addressId?.fullAddress}<br>
                                ${order.addressId?.city}, ${order.addressId?.pincode}<br>
                                <strong>Tel:</strong> ${order.addressId?.phone}
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
                                <th align="left" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Item Details</th>
                                <th align="center" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Qty</th>
                                <th align="right" style="padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding: 30px 40px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="right" style="font-family: Arial, sans-serif; font-size: 16px; color: #1a1a1a;">
                                <span>Grand Total:</span>
                                <span style="font-size: 24px; font-weight: bold; margin-left: 10px;">$${order.totalAmount.toFixed(2)}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding: 0 40px 40px 40px; text-align: center;">
                    <a href="https://zippyyy.com/admin/orders" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 15px 35px; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 1px; border-radius: 2px; text-transform: uppercase;">
                        Review Order Details
                    </a>
                </td>
            </tr>

            <tr>
                <td style="background-color: #fbfbfb; padding: 20px 40px; text-align: center; border-top: 1px solid #eee;">
                    <p style="font-family: Arial, sans-serif; font-size: 11px; color: #999; margin: 0;">
                        &copy; ${new Date().getFullYear()} Zippyyy Dashboard. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </div>`;
}

module.exports = AdminAlert;




// const AdminAlert = (order) => {
//     return `
//     <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #333; max-width: 600px;">
//         <h2 style="color: #d9534f;">🚨 New Order Received!</h2>
//         <p><strong>Order ID:</strong> #${order.orderNumber}</p>
//         <p><strong>Total Value:</strong> $${order.totalAmount}</p>
//         <hr>
//         <h4>Customer Details:</h4>
//         <p>Name: ${order.userId?.name}<br>Email: ${order.userId?.email}</p>
        
//         <h4>Shipping Details:</h4>
//         <p>
//             ${order.addressId?.fullAddress}<br>
//             ${order.addressId?.city}, ${order.addressId?.pincode}<br>
//             <strong>Contact:</strong> ${order.addressId?.phone}
//         </p>
//         <a href="https://zippyyy.com/admin/orders" style="padding: 10px; background: #333; color: #fff; text-decoration: none;">View on Admin Panel</a>
//     </div>`;
// }

// module.exports = AdminAlert;