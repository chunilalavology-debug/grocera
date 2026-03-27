const CONSTANTS = require('./constants')
const ObjectId = require('mongoose').Types.ObjectId;
const randomIntFromInterval = (min, max) => {
  return Math.floor(
    Math.random() * (max - min + 1) + min
  );
}

const { DECRYPTED_PASS } = process.env

const resultDb = (statusCode, data = null) => {
  return {
    statusCode: statusCode,
    data: data
  };
}

const apiSuccessRes = (req, res, message = CONSTANTS.DATA_NULL, data = CONSTANTS.DATA_NULL, code = CONSTANTS.ERROR_CODE_ZERO, error = CONSTANTS.ERROR_FALSE, token, currentDate) => {
  return res.status(200).json({
    message: message,
    code: code,
    error: error,
    data: data,
    token: token,
    currentDate
  });
}

const apiErrorRes = (req, res, message = CONSTANTS.DATA_NULL, data = CONSTANTS.DATA_NULL, code = CONSTANTS.ERROR_CODE_ONE, error = CONSTANTS.ERROR_TRUE) => {
  return res.status(200).json({
    message: message,
    code: code,
    error: error,
    data: data
  });
}




const isValidObjectId = (id) => {
	
	if(ObjectId.isValid(id)){
		if((String)(new ObjectId(id)) === id)
			return true;	 
		return false;
	}
	return false;
}
const AVAILABLE_TUITIONS = 'availableTuitions';
const ASSIGN_DEMO = 'assignedDemo';
const COMPLETED_DEMO = 'completedDemo';
const ONGOING_TUITIONS = 'ongoingTuitions';
const CLOSED_TUITIONS = 'closedTuition';
const REQUESTED_DEMO = 'requestedDemo';
const RECEIVED_ASSIGNMENTS = 'receivedAssignments';
const SHARED_ASSIGNMENTS = 'sharedAssignments';
const MARK_ATTENDANCE = 'markAttendance';
const PAYMENT_HISTORY = 'paymentHistory';
const HOLIDAY_CALENDAR = 'holidayCalendar';
const STUDY_CENTER = 'studyCenter';
const REFER_AND_EARN = 'referAndEarn';
const SUPPORT = 'support';
const CHECK_ATTENDANCE = 'checkAttendance';

const userSettingType = (state) => {
  switch (state) {
    case 'AVAILABLE_TUITIONS':
      return AVAILABLE_TUITIONS;
    case 'ASSIGN_DEMO':
      return ASSIGN_DEMO;
    case 'COMPLETED_DEMO':
      return COMPLETED_DEMO;
    case 'ONGOING_TUITIONS':
      return ONGOING_TUITIONS;
    case 'CLOSED_TUITIONS':
      return CLOSED_TUITIONS;
    case 'REQUESTED_DEMO':
      return REQUESTED_DEMO;
    case 'RECEIVED_ASSIGNMENTS':
      return RECEIVED_ASSIGNMENTS;
    case 'SHARED_ASSIGNMENTS':
      return SHARED_ASSIGNMENTS;
    case 'MARK_ATTENDANCE':
      return MARK_ATTENDANCE;
    case 'PAYMENT_HISTORY':
      return PAYMENT_HISTORY;
    case 'HOLIDAY_CALENDAR':
      return HOLIDAY_CALENDAR;
    case 'STUDY_CENTER':
      return STUDY_CENTER;
    case 'REFER_AND_EARN':
      return REFER_AND_EARN;
    case 'SUPPORT':
      return SUPPORT;
    case 'CHECK_ATTENDANCE':
      return CHECK_ATTENDANCE;
    default:
      return 'unknownState';
  }
};

const uniqueArrayOfObj = (array = [], key = "_id") => {
  return [...new Map(array.map((item) => [item[key], item])).values()];
};



module.exports = {
  resultDb,
  apiSuccessRes,
  apiErrorRes,
  randomIntFromInterval,
  isValidObjectId,
  userSettingType,
  uniqueArrayOfObj
};