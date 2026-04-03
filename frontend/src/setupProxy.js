const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Proxies the Zippyyy Ships Express API (:3001) while CRA runs on :3000.
 * The embedded app uses same-origin /api/*. Main grocery API uses REACT_APP_API_URL → :5000, so no clash.
 */
module.exports = function setupProxy(app) {
  const target = process.env.REACT_APP_SHIPS_API_PROXY || 'http://127.0.0.1:3001';
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    }),
  );
};
