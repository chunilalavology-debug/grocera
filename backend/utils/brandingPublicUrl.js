const path = require("path");

/**
 * Public path for a file saved under the server's uploads directory (served at GET /uploads/:file).
 * Always relative so the browser can prefix the correct API origin (dev proxy, split deploy, etc.).
 */
function uploadsPublicPath(filename) {
  const base = path.basename(String(filename || ""));
  if (!base || base === "..") return "";
  return `/uploads/${base}`;
}

/**
 * If DB has a full URL like http://localhost:5000/uploads/x.png, return /uploads/x.png
 * so clients attach their own API origin.
 */
function normalizeStoredUploadsUrl(stored) {
  const s = String(stored || "").trim();
  if (!s) return "";
  const noQuery = s.split("?")[0];
  if (noQuery.startsWith("/uploads/")) return noQuery;
  try {
    const u = new URL(s);
    const p = (u.pathname || "").split("?")[0];
    if (p.startsWith("/uploads/")) return p;
  } catch (_) {
    /* ignore */
  }
  return s;
}

module.exports = { uploadsPublicPath, normalizeStoredUploadsUrl };
