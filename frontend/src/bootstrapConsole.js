/**
 * Production: silence noisy console methods in the browser (keeps warn/error for real issues).
 * Set REACT_APP_DEBUG=1 at build time to keep full logging.
 */
if (
  process.env.NODE_ENV === "production" &&
  String(process.env.REACT_APP_DEBUG || "").trim() !== "1"
) {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
}
