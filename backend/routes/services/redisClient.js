/**
 * Single Redis connection for serverless (Vercel) + local dev.
 * Set REDIS_URL in Vercel (e.g. Upstash: rediss://default:...@...upstash.io:6379)
 */
const asyncRedis = require("async-redis");

const url = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();

/** Local dev without Redis: stop reconnect storm (was noisy and looked like a crash). */
function localRedisRetryStrategy(options) {
  if (options.error && options.error.code === "ECONNREFUSED") {
    return undefined;
  }
  if (options.total_retry_time > 5000) {
    return undefined;
  }
  return Math.min(options.attempt * 200, 2000);
}

const client = url
  ? asyncRedis.createClient(url)
  : asyncRedis.createClient({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: localRedisRetryStrategy,
    });

let redisWarned = false;
client.on("error", (err) => {
  if (!redisWarned && err.code === "ECONNREFUSED") {
    redisWarned = true;
    console.warn(
      "Redis: not running on localhost (optional for local dev). Set REDIS_URL for production/Vercel."
    );
    return;
  }
  if (!redisWarned || err.code !== "ECONNREFUSED") {
    console.error("Redis:", err.message);
  }
});

module.exports = client;
