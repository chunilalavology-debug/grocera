/**
 * Proxies the embedded Zippyyy Ships app (same-origin /api/*) to the Node ships server.
 * Set SHIPS_API_BASE on Vercel (e.g. https://your-ships-api.railway.app) — no trailing slash.
 */

async function forwardToShips(req, res, apiPath) {
  const raw = process.env.SHIPS_API_BASE || process.env.ZIPPYYY_SHIPS_API_URL || "";
  const base = raw.replace(/\/$/, "");
  if (!base) {
    res.status(503).json({
      error: "SHIPS_API_NOT_CONFIGURED",
      message:
        "Set SHIPS_API_BASE in this Vercel project to your Zippyyy Ships server URL (Express /api).",
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST." });
    return;
  }

  const url = `${base}/api/${apiPath}`;
  let body;
  try {
    body = JSON.stringify(req.body ?? {});
  } catch {
    res.status(400).json({ error: "INVALID_BODY" });
    return;
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.SHIPS_PROXY_TIMEOUT_MS) || 90_000, 5_000),
    110_000
  );

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? e.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      res.status(504).json({
        error: "SHIPS_UPSTREAM_TIMEOUT",
        message:
          "Shipping quotes timed out. Ensure SHIPS_API_BASE points to your Zippyyy Ships server, upgrade Vercel function duration if needed (quotes), and verify EASYSHIP_API_KEY on the Ships deployment.",
      });
      return;
    }
    res.status(502).json({
      error: "SHIPS_UPSTREAM_UNREACHABLE",
      message: e instanceof Error ? e.message : "Failed to reach ships API",
    });
    return;
  }

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  res.status(upstream.status).send(text);
}

module.exports = { forwardToShips };
