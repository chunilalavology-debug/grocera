const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Windows often resolves `localhost` to IPv6 (::1) while Node may only accept IPv4 on 127.0.0.1,
 * which breaks the dev proxy with ECONNREFUSED. Force loopback to 127.0.0.1.
 */
function normalizeLoopbackTarget(origin) {
  try {
    const u = new URL(origin);
    if (
      u.hostname === 'localhost' ||
      u.hostname === '::1' ||
      u.hostname === '[::1]'
    ) {
      u.hostname = '127.0.0.1';
    }
    return u.origin;
  } catch (_) {
    return origin;
  }
}

/**
 * Resolve Express origin (no path) for the grocery API.
 * Prefer REACT_APP_GROCERY_API_PROXY; else derive from REACT_APP_API_URL when it is
 * localhost/127.0.0.1 so .env.development port matches the proxy (apiBase uses same-origin /api in dev).
 */
function getGroceryProxyTarget() {
  let raw;
  const explicit = process.env.REACT_APP_GROCERY_API_PROXY;
  if (explicit && String(explicit).trim()) {
    raw = String(explicit).trim().replace(/\/+$/, '');
  } else {
    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && String(apiUrl).trim()) {
      try {
        const u = new URL(String(apiUrl).trim());
        const h = u.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') {
          raw = `${u.protocol}//${u.host}`;
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (!raw) raw = 'http://localhost:5000';
  }
  return normalizeLoopbackTarget(raw);
}

/**
 * CRA dev server (:3000) → grocery Express API.
 * Same-origin /api and /uploads avoids CORS and fixes multipart uploads locally.
 *
 * If you see "Error occurred while trying to proxy", nothing is listening on the target
 * (default http://localhost:5000). Start the backend from grocera/backend, or if port 5000
 * is taken set PORT=5001 in backend/.env and REACT_APP_API_URL=http://localhost:5001/api
 * in frontend/.env.local (restart npm start).
 */
module.exports = function setupProxy(app) {
  const target = getGroceryProxyTarget();
  // eslint-disable-next-line no-console
  console.log('[setupProxy] /api and /uploads →', target);

  const groceryProxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    /** Windows / mixed stacks: avoid hanging on bad upstream */
    proxyTimeout: 60_000,
    onError(err, req, res) {
      if (res.headersSent) return;
      const hint =
        `Grocery API not reachable at ${target}. From the repo root run the backend (e.g. cd grocera/backend && npm start) so it listens on the same port, or set REACT_APP_GROCERY_API_PROXY=http://127.0.0.1:YOUR_PORT in .env`;
      console.error('[setupProxy]', err.code || err.message, '→', req.method, req.url);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: hint,
          code: err.code || 'EPROXY',
        })
      );
    },
  });

  app.use('/api', groceryProxy);
  app.use('/uploads', groceryProxy);
};
