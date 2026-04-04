/**
 * GET /api/health — proxies to the ships server so you can verify:
 * { "easyshipConfigured": true } means EASYSHIP_API_KEY is set on the ships deployment.
 */
module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const raw = process.env.SHIPS_API_BASE || process.env.ZIPPYYY_SHIPS_API_URL || "";
  const base = raw.replace(/\/$/, "");
  if (!base) {
    return res.status(503).json({
      ok: false,
      error: "SHIPS_API_NOT_CONFIGURED",
      message:
        "Set SHIPS_API_BASE on this Vercel project to your ships API URL (the service where EASYSHIP_API_KEY lives).",
    });
  }

  try {
    const upstream = await fetch(`${base}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: "SHIPS_UPSTREAM_UNREACHABLE",
      message: e instanceof Error ? e.message : "Failed to reach ships API",
    });
  }
};
