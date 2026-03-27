const asyncRedis = require('async-redis');
const { NOT_FOUND, DATA_NULL, SUCCESS, SERVER_ERROR } = require('./constants.js');
const { resultDb } = require('./globalFunction.js');

const client = asyncRedis.createClient({
    // host: "139.162.218.18",
    // port: 6379,
    // password: "your-redis-password",
});

exports.getKey = async (key) => {
    try {
        const value = await client.get(key.toString());
        if (value === null) {
            return resultDb(NOT_FOUND);
        } else {
            return resultDb(SUCCESS, value);
        }
    } catch (error) {
        console.error("Unable to get key from redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKey = async (key, value) => {
    try {
        await client.set(key, value, 'EX', 60 * 10); // 10 minutes
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKeyOneHoure = async (key, value) => {
    try {
        await client.set(key, value, 'EX', 60 * 10 * 10);
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKeyWithOneYear = async (key, value) => {
    try {
        await client.set(key, value, 'EX', 60 * 60 * 24 * 365); // 1 year
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKeyWithAllTime = async (key, value) => {
    try {
        await client.set(key, value);
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKeyNoTime = async (key, value) => {
    try {
        await client.set(key, value);
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key no time in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.setKeyWithTime = async (key, value, time) => {
    try {
        await client.set(key, value, 'EX', 60 * time); // `time` in minutes
        return resultDb(SUCCESS);
    } catch (error) {
        console.log(error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};

exports.removeKey = async (key) => {
    try {
        const value = await client.del(key.toString());
        if (value === 0) {
            return resultDb(NOT_FOUND);
        } else {
            return resultDb(SUCCESS, value);
        }
    } catch (error) {
        console.error("Unable to remove key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};
