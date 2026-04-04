const redisClient = require("../services/serviceRedis-cli");

const userSellRateLimiter = async (req, res, next) => {
  const ip = req.ip;
  const key = `rate:userSell:${ip}`;
  const windowSeconds = 600;
  const maxHits = 5;

  try {
    let current = await redisClient.get(key);
    const nextAtment = windowSeconds / 60;

    if (current) {
      current = parseInt(current);

      if (current >= maxHits) {
        return res.status(429).send({
          success: false,
          message: `Too many requests. Please try again after ${nextAtment} minutes.`,
          data: null
        });
      }

      await redisClient.incr(key);
    } else {
      await redisClient.set(key, 1);
      await redisClient.expire(key, windowSeconds);
    }

    next();
  } catch (err) {
    console.error("Rate limit error (allowing request):", err.message);
    next();
  }
};

module.exports = userSellRateLimiter;
