const asyncRedis = require("async-redis");

/**
 * Same as serviceRedis.js: never connect to localhost:6379 on Vercel unless Redis is configured.
 */
const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

let redisClient;

if (redisConfigured) {
  const opts = process.env.REDIS_URL
    ? process.env.REDIS_URL
    : {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        connect_timeout: 8000,
      };
  redisClient =
    typeof opts === "string"
      ? asyncRedis.createClient(opts)
      : asyncRedis.createClient(opts);
  redisClient.on("error", (err) => {
    console.error("Redis error:", err);
  });
} else {
  redisClient = {
    get: async () => null,
    set: async () => "OK",
    incr: async () => 1,
    expire: async () => 1,
    del: async () => 0,
  };
}

module.exports = redisClient;
