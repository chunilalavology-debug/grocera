const app = require("../app");

function headerOne(req, name) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Vercel may emit `__vercel_path`, `___vercel_path`, etc. — must not reach Joi `req.query`. */
function stripInternalVercelPathParams(urlString) {
  if (!urlString || typeof urlString !== "string" || !urlString.includes("?")) {
    return urlString;
  }
  const fakeBase = "http://internal";
  try {
    const u = new URL(urlString, fakeBase);
    let changed = false;
    for (const key of [...u.searchParams.keys()]) {
      if (/^_{2,}vercel_path$/i.test(key)) {
        u.searchParams.delete(key);
        changed = true;
      }
    }
    if (!changed) return urlString;
    const q = u.searchParams.toString();
    return u.pathname + (q ? `?${q}` : "");
  } catch (_) {
    return urlString;
  }
}

/**
 * Vercel rewrites send traffic to `/api/index`, so Express sees the wrong `req.url`.
 * 1) Prefer `__vercel_path` from vercel.json rewrites (reliable).
 * 2) Fallback: headers some runtimes set.
 */
function restoreVercelRequestUrl(req) {
  if (!process.env.VERCEL) return;

  const fakeBase = "http://internal";
  let u;
  try {
    u = new URL(req.url || "/", fakeBase);
  } catch (_) {
    return;
  }

  const vp =
    u.searchParams.get("__vercel_path") || u.searchParams.get("___vercel_path");
  if (vp != null && String(vp).length > 0) {
    u.searchParams.delete("__vercel_path");
    u.searchParams.delete("___vercel_path");
    for (const key of [...u.searchParams.keys()]) {
      if (/^_{2,}vercel_path$/i.test(key)) u.searchParams.delete(key);
    }
    const rest = String(vp).replace(/^\/+/, "");
    const path =
      rest.startsWith("upload/") || rest.startsWith("uploads/")
        ? `/${rest}`
        : `/api/${rest}`;
    const q = u.searchParams.toString();
    req.url = path + (q ? `?${q}` : "");
    req.originalUrl = req.url;
    return;
  }

  const raw =
    headerOne(req, "x-vercel-original-path") ||
    headerOne(req, "x-invoke-path") ||
    headerOne(req, "x-url") ||
    headerOne(req, "x-original-url") ||
    headerOne(req, "x-forwarded-uri");

  if (!raw || typeof raw !== "string") return;

  let pathname = raw.trim();
  if (pathname.includes("://")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch (_) {
      return;
    }
  } else {
    pathname = pathname.split("?")[0];
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  if (pathname === "/api/index" || pathname === "/api" || pathname === "/") return;
  if (!pathname.startsWith("/api/")) return;

  const existingQuery =
    typeof req.url === "string" && req.url.includes("?")
      ? req.url.slice(req.url.indexOf("?"))
      : raw.includes("?")
        ? `?${raw.split("?").slice(1).join("?")}`
        : "";

  req.url = pathname + existingQuery;
  req.originalUrl = req.url;
}

module.exports = (req, res) => {
  restoreVercelRequestUrl(req);
  req.url = stripInternalVercelPathParams(req.url);
  req.originalUrl = req.url;
  return app(req, res);
};
