const { forwardToShipsGet } = require("../lib/forwardToShipsGet");

/**
 * GET /api/easyship/item-categories — debug / tooling (matches ships server route).
 */
module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  await forwardToShipsGet(req, res, "easyship/item-categories");
};
