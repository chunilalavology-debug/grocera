/**
 * Short, safe strings for JSON `message` (no HTML pages, no multi-KB stack dumps in the UI).
 */
function safeApiMessage(err, fallback = "Request failed") {
  if (err == null) return fallback;
  let m = "";
  if (typeof err.message === "string" && err.message.trim()) {
    m = err.message.trim();
  } else if (err.error && typeof err.error.message === "string" && err.error.message.trim()) {
    m = err.error.message.trim();
  } else if (typeof err === "string" && err.trim()) {
    m = err.trim();
  } else {
    m = "";
  }
  if (!m || m === "[object Object]") return fallback;
  if (/^<!DOCTYPE/i.test(m) || /<html[\s>]/i.test(m)) {
    return "Invalid server response. Check API URL, auth, or try again.";
  }
  if (m.length > 260) return `${m.slice(0, 257)}…`;
  return m;
}

module.exports = { safeApiMessage };
