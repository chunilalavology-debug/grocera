/**
 * Legacy path — use `routes/services/serviceRedis.js` (single shared `redisClient`).
 * Re-export avoids a second hidden Redis connection if anything required this file.
 */
module.exports = require("../routes/services/serviceRedis");
