/**
 * Single Redis connection for serverless (Vercel) + local dev.
 * Set REDIS_URL in Vercel (e.g. Upstash: rediss://default:...@...upstash.io:6379)
 */
const asyncRedis = require("async-redis");

const url = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();

const client = url
  ? asyncRedis.createClient(url)
  : asyncRedis.createClient({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

client.on("error", (err) => {
  console.error("Redis:", err.message);
});

module.exports = client;
