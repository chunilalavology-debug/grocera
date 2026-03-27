const { Activity } = require('../../db');
const { DATA_NULL, SUCCESS, SERVER_ERROR, NOT_FOUND } = require('../../utils/constants');
const { resultDb } = require('../../utils/globalFunction')
const moment = require('moment');


const saveActivity = async (activityData) => {
    try {
        const activityInstance = new Activity(activityData);
        const response = await activityInstance.save();
        return resultDb(SUCCESS, response);
    } catch (error) {
        if (error.code) {
            return resultDb(error.code, DATA_NULL);
        }
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};


const getActivityList = async (data) => {
    try {
        const query = {};
        const sortOrder = data?.sortOrder === 'asc' ? 1 : -1;

        if (data?.keyWord && data?.keyWord !== '') {
            query['name'] = { $regex: data.keyWord, $options: 'i' };
        }

        if (data && data?.userId) {
            query['userId'] = data.userId
        }

        if (data && data?.demoId) {
            query['demoId'] = data.demoId
        }

        if (data.fromDate) {
            const startTime = moment(data.fromDate).startOf('day').valueOf()
            query['createdAt'] = { ...query['createdAt'], $gte: startTime };
        }
        if (data.toDate) {
            const endTime = moment(data.toDate).endOf('day').valueOf()
            query['createdAt'] = { ...query['createdAt'], $lte: endTime };
        }

        const sortBy = data?.sortBy || 'createdAt';
        const total = await Activity.countDocuments(query);
        const list = await Activity.find(query).populate('isAdmin', 'userName mobNo image').populate('userId', 'name mobNo image userType').sort({ [sortBy]: sortOrder })
            .skip((data.pageNo - 1) * data.size)
            .limit(data.size).lean();

        return resultDb(SUCCESS, { total, list });
    } catch (error) {
        console.error('Error retrieving banner list:', error);
        return resultDb(SERVER_ERROR, DATA_NULL);
    }
};



module.exports = {
    saveActivity,
    getActivityList
};
