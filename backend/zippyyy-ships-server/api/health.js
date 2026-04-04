/**
 * Dedicated /api/health — no Express import (avoids Vercel hangs on nested /api/* routing).
 */
export default function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const body = JSON.stringify({
    ok: true,
    easyshipConfigured: Boolean(
      typeof process.env.EASYSHIP_API_KEY === "string" && process.env.EASYSHIP_API_KEY.trim().length > 0,
    ),
    stripeConfigured: Boolean(
      typeof process.env.STRIPE_SECRET_KEY === "string" && process.env.STRIPE_SECRET_KEY.trim().length > 0,
    ),
    stripeWebhookConfigured: Boolean(
      typeof process.env.STRIPE_WEBHOOK_SECRET === "string" &&
        process.env.STRIPE_WEBHOOK_SECRET.trim().length > 0,
    ),
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}
