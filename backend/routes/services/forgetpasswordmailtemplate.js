const forgetPwdTemp = (data) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
  </head>

  <body style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:20px 0;">

          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:#1e88e5; padding:20px; text-align:center;">
                <img
                  src="https://res.cloudinary.com/dcxhrd0rd/image/upload/v1768202695/kmaaz074hwrzy6er2ono.svg"
                  alt="Zippyyy"
                  height="48"
                  style="display:block; margin:0 auto;"
                />
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:32px;">
                <h2 style="color:#1e88e5; margin:0 0 12px;">
                  Reset your password
                </h2>

                <p style="color:#555; font-size:15px; line-height:1.6; margin:0 0 16px;">
                  Hi <strong>${data?.name || "there"}</strong>,
                </p>

                <p style="color:#555; font-size:15px; line-height:1.6; margin:0 0 20px;">
                  We received a request to reset your account password.
                  Click the button below to set a new password.
                </p>

                <!-- Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a
                    href="${data?.resetLink}"
                    style="
                      background:#1e88e5;
                      color:#ffffff;
                      padding:14px 32px;
                      text-decoration:none;
                      border-radius:6px;
                      font-size:16px;
                      font-weight:600;
                      display:inline-block;
                    "
                  >
                    Reset Password
                  </a>
                </div>

                <p style="color:#777; font-size:13px; line-height:1.6; margin:0 0 10px;">
                  If you did not request a password reset, you can safely ignore this email.
                  Your account remains secure.
                </p>

                <p style="color:#999; font-size:12px; margin:24px 0 0;">
                  This password reset link will expire in <strong>15 minutes</strong>.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f1f5f9; padding:16px; text-align:center; font-size:12px; color:#777;">
                © 2026 Zippyyy • Fresh Grocery Delivered to Your Doorstep<br />
                Need help? Contact us at
                <a href="mailto:support@zippyyy.com" style="color:#1e88e5; text-decoration:none;">
                  support@zippyyy.com
                </a>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

export default forgetPwdTemp;
