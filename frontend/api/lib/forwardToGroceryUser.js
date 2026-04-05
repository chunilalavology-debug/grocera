/**
 * Proxies POST /api/user/shipping/* from the storefront Vercel app to the real grocery API.
 * Embedded Zippyyy Ships uses VITE_GROCERA_API_BASE=/api (same origin), but the SPA host
 * is not the Node API — without this proxy, POST hits the catch-all rewrite → 405.
 *
 * Set REACT_APP_API_URL on this Vercel project (e.g. https://your-api.vercel.app/api), or
 * GROCERY_API_BASE to the same value.
 */

function normalizeGroceryApiBase() {
  let b = String(process.env.GROCERY_API_BASE || "").trim();
  if (b) {
    b = b.replace(/\/+$/, "");
    if (!/\/api$/i.test(b)) b = `${b}/api`;
    return b;
  }
  let r = String(process.env.REACT_APP_API_URL || "").trim().replace(/\/+$/, "");
  if (!r) return "";
  if (!/\/api$/i.test(r)) r = `${r}/api`;
  return r;
}

async function forwardToGroceryUser(req, res, suffixPath) {
  const apiBase = normalizeGroceryApiBase();
  if (!apiBase) {
    return res.status(503).json({
      success: false,
      message:
        "Set REACT_APP_API_URL (e.g. https://your-grocery-api.vercel.app/api) or GROCERY_API_BASE on this Vercel project so embedded Ships can reach the grocery API.",
    });
  }

  const method = String(req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "Use POST.",
    });
  }

  const url = `${apiBase}/user/${suffixPath}`;
  let body;
  try {
    body = JSON.stringify(req.body ?? {});
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.trim()) {
    headers.Authorization = auth.trim();
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.GROCERY_PROXY_TIMEOUT_MS) || 90_000, 5_000),
    110_000,
  );

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? e.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      return res.status(504).json({
        success: false,
        message: "Grocery API request timed out. Check REACT_APP_API_URL and API function duration.",
      });
    }
    return res.status(502).json({
      success: false,
      message: e instanceof Error ? e.message : "Could not reach grocery API",
    });
  }

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  res.status(upstream.status).send(text);
}

module.exports = { forwardToGroceryUser, normalizeGroceryApiBase };
