/**
 * Shared Redis-related env checks (connection details live in routes/services/redisClient.js).
 */

function envFlagTrue(name) {
  const v = String(process.env[name] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isRedisExplicitlyDisabled() {
  return envFlagTrue("REDIS_DISABLED") || envFlagTrue("SKIP_REDIS");
}

/**
 * True when Redis is intended for catalog cache / invalidation (any explicit connection hint, not disabled).
 * Prefer REDIS_URL (Upstash) or REDIS_HOST + REDIS_PORT on a VPS.
 */
function isRedisConfiguredInEnv() {
  if (isRedisExplicitlyDisabled()) return false;
  const u = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();
  const h = process.env.REDIS_HOST && String(process.env.REDIS_HOST).trim();
  const p = process.env.REDIS_PORT && String(process.env.REDIS_PORT).trim();
  return Boolean(u || h || p);
}

module.exports = {
  envFlagTrue,
  isRedisExplicitlyDisabled,
  isRedisConfiguredInEnv,
};
