/**
 * Single Redis connection for serverless (Vercel) + local dev.
 * Set REDIS_URL in Vercel (e.g. Upstash: rediss://default:...@...upstash.io:6379)
 *
 * VPS without Redis: REDIS_DISABLED=1 — no TCP; catalog cache skipped in controllerUser;
 * rate limits are weaker (see rateLimit middleware).
 */
const asyncRedis = require("async-redis");

function envFlagTrue(name) {
  const v = String(process.env[name] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const redisExplicitlyDisabled = envFlagTrue("REDIS_DISABLED") || envFlagTrue("SKIP_REDIS");

/** No TCP — avoids ECONNREFUSED when Redis is not installed on the VPS. */
function createNoopRedisClient() {
  return {
    get: async () => null,
    set: async () => "OK",
    del: async () => 0,
    keys: async () => [],
    incr: async () => 1,
    expire: async () => 1,
    quit: async () => "OK",
    disconnect: () => {},
    on: () => {},
  };
}

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

let client;
if (redisExplicitlyDisabled) {
  client = createNoopRedisClient();
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[redis] REDIS_DISABLED=1 — Redis not used. Install redis-server and unset REDIS_DISABLED for cache + stronger rate limits.",
    );
  }
} else {
  /** One options object so REDIS_URL clients get retry_strategy (avoids infinite reconnect + log spam). */
  const clientOptions = {
    retry_strategy: localRedisRetryStrategy,
  };
  if (url) {
    clientOptions.url = url;
  } else {
    clientOptions.host = process.env.REDIS_HOST || "127.0.0.1";
    clientOptions.port = Number(process.env.REDIS_PORT) || 6379;
    if (process.env.REDIS_PASSWORD) {
      clientOptions.password = process.env.REDIS_PASSWORD;
    }
  }
  client = asyncRedis.createClient(clientOptions);

  let redisWarned = false;
  client.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      if (!redisWarned) {
        redisWarned = true;
        console.warn(
          "Redis ECONNREFUSED (nothing on port 6379). On the VPS run: sudo apt install -y redis-server && sudo systemctl enable --now redis-server && redis-cli ping",
        );
      }
      return;
    }
    console.error("Redis:", err.message);
  });
}

module.exports = client;
