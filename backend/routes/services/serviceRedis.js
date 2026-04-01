const asyncRedis = require("async-redis");

const { NOT_FOUND, DATA_NULL, SUCCESS, SERVER_ERROR } = require("../../utils/constants");
const { resultDb } = require("../../utils/globalFunction");

/**
 * Without REDIS_URL or REDIS_HOST, do not open a TCP client to localhost:6379.
 * On Vercel that hangs until the function times out (504).
 */
const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

let client = null;

if (redisConfigured) {
  const opts = process.env.REDIS_URL
    ? process.env.REDIS_URL
    : {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        connect_timeout: 8000,
      };
  client =
    typeof opts === "string"
      ? asyncRedis.createClient(opts)
      : asyncRedis.createClient(opts);
  client.on("error", (err) => {
    console.error("Redis Error:", err);
  });
}

const getKey = async (key) => {
  if (!client) {
    return resultDb(NOT_FOUND);
  }
  try {
    const value = await client.get(key.toString());
    if (value === null) {
      return resultDb(NOT_FOUND);
    }
    return resultDb(SUCCESS, value);
  } catch (error) {
    console.error("Unable to get key from redis, Query", error);
    return resultDb(SERVER_ERROR);
  }
};

const setKey = async (key, value) => {
  if (!client) {
    return resultDb(SUCCESS);
  }
  try {
    await client.set(key, value, "EX", 60 * 10);
    return resultDb(SUCCESS);
  } catch (error) {
    console.error("Unable to set key in redis, Query", error);
    return resultDb(SERVER_ERROR, DATA_NULL);
  }
};

const setKeyWithOneYear = async (key, value) => {
  if (!client) {
    return resultDb(SUCCESS);
  }
  try {
    await client.set(key, value, "EX", 60 * 60 * 24 * 365);
    return resultDb(SUCCESS);
  } catch (error) {
    console.error("Unable to set key in redis, Query", error);
    return resultDb(SERVER_ERROR, DATA_NULL);
  }
};

const setKeyNoTime = async (key, value) => {
  if (!client) {
    return resultDb(SUCCESS);
  }
  try {
    await client.set(key, value);
    return resultDb(SUCCESS);
  } catch (error) {
    console.error("Unable to set key no time in redis, Query", error);
    return resultDb(SERVER_ERROR, DATA_NULL);
  }
};

const setKeyWithTime = async (key, value, time) => {
  if (!client) {
    return resultDb(SUCCESS);
  }
  try {
    await client.set(key, value, "EX", 60 * time);
    return resultDb(SUCCESS);
  } catch (error) {
    console.log(error);
    return resultDb(SERVER_ERROR, DATA_NULL);
  }
};

const removeKey = async (key) => {
  if (!client) {
    return resultDb(NOT_FOUND);
  }
  try {
    const value = await client.del(key.toString());
    if (value === 0) {
      return resultDb(NOT_FOUND);
    }
    return resultDb(SUCCESS, value);
  } catch (error) {
    console.error("Unable to remove key in redis, Query", error);
    return resultDb(SERVER_ERROR, DATA_NULL);
  }
};

module.exports = {
  getKey,
  setKeyNoTime,
  removeKey,
  setKeyWithTime,
  setKey,
  setKeyWithOneYear,
};
