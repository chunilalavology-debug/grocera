const globalFunction = require('./globalFunction');
const CONSTANT = require('./constants');
const { City } = require('../db/index')
const { resultDb } = require('./globalFunction')

async function managementHandler(isManagement) {
    try {
        const cityData = await City.find({
            isManagement: JSON.parse(isManagement)
        })
        const mapData = cityData && cityData.length && cityData.length > 0 ? cityData.map((ele) => ele?._id) : []
        return resultDb(CONSTANT.SUCCESS, mapData)
    } catch (error) {
        console.log('error::::::', error);
        return resultDb(CONSTANT.SERVER_ERROR, CONSTANT.DATA_NULL);
    }

}
module.exports = managementHandler;