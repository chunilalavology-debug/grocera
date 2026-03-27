const asyncRedis = require("async-redis");
const redisClient = asyncRedis.createClient();

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

module.exports = redisClient;
