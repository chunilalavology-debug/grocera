/**
 * Proxies GET/HEAD from storefront /api/* to SHIPS_API_BASE.
 */

const FORWARD_HEADERS = ["content-type", "content-disposition", "location", "cache-control"];

async function forwardToShipsGet(req, res, pathAfterApi) {
  const raw = process.env.SHIPS_API_BASE || process.env.ZIPPYYY_SHIPS_API_URL || "";
  const base = raw.replace(/\/$/, "");
  if (!base) {
    res.status(503).json({
      error: "SHIPS_API_NOT_CONFIGURED",
      message:
        "Set SHIPS_API_BASE on this Vercel project to your Zippyyy Ships server URL (Express /api).",
    });
    return;
  }

  const url = `${base}/api/${pathAfterApi}`;
  const method = req.method === "HEAD" ? "HEAD" : "GET";

  let upstream;
  try {
    upstream = await fetch(url, {
      method,
      headers: {
        Accept: typeof req.headers.accept === "string" ? req.headers.accept : "*/*",
      },
      redirect: "manual",
    });
  } catch (e) {
    res.status(502).json({
      error: "SHIPS_UPSTREAM_UNREACHABLE",
      message: e instanceof Error ? e.message : "Failed to reach ships API",
    });
    return;
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) res.setHeader("Location", loc);
    res.status(upstream.status);
    FORWARD_HEADERS.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    return res.end();
  }

  FORWARD_HEADERS.forEach((h) => {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  });

  if (method === "HEAD") {
    return res.status(upstream.status).end();
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.status(upstream.status).send(buf);
}

module.exports = { forwardToShipsGet };
