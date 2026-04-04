const { forwardToShipsGet } = require("../lib/forwardToShipsGet");

/**
 * GET /api/shipments/:checkoutSessionId — status JSON (CheckoutSuccess page).
 */
module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const id = req.query.checkoutSessionId;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "MISSING_SESSION_ID" });
  }

  await forwardToShipsGet(req, res, `shipments/${encodeURIComponent(id)}`);
};
