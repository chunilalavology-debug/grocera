const client = require("./redisClient");

const { NOT_FOUND, DATA_NULL, SUCCESS, SERVER_ERROR } = require('../../utils/constants');


let { resultDb } = require('../../utils/globalFunction')


let getKey = async (key) => {
    try {
        const value = await client.get(key.toString());
        if (value === null) {
            return resultDb(NOT_FOUND)
        } else {
            return resultDb(SUCCESS, value)
        }

    } catch (error) {
        console.error("Unable to get key from redis, Query", error);
        return resultDb(SERVER_ERROR)
    }
};
let setKey = async (key, value) => {
    try {
        await client.set(key, value, 'EX', 60 * 10);
        return resultDb(SUCCESS)
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL)
    }
};
let setKeyWithOneYear = async (key, value) => {
    try {
        await client.set(key, value, 'EX', 60 * 60 * 24 * 365);
        return resultDb(SUCCESS);
    } catch (error) {
        console.error("Unable to set key in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};
let setKeyNoTime = async (key, value) => {
    try {
        await client.set(key, value);
        return resultDb(SUCCESS)
    } catch (error) {
        console.error("Unable to set key no time in redis, Query", error);
        return resultDb(SERVER_ERROR, DATA_NULL)
    }
};
let setKeyWithTime = async (key, value, time) => {
    try {
        await client.set(key, value, 'EX', 60 * time);
        return resultDb(SUCCESS)
    } catch (error) {
        console.error("setKeyWithTime:", error);
        return resultDb(SERVER_ERROR, DATA_NULL)
    }
};
let removeKey = async (key) => {
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

module.exports = {
    getKey,
    setKeyNoTime,
    removeKey,
    setKeyWithTime,
    setKey,
    setKeyWithOneYear
};