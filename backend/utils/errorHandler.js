const globalFunction = require('./globalFunction');
const CONSTANT = require('./constants');
const apiErrorRes = globalFunction.apiErrorRes;

function errorHandler(err, req, res, next) {
    console.error("errorHandler:", err);
    if (typeof (err) === 'string') {
        return apiErrorRes(req, res, "Error");
    }
    if (err.name === 'UnauthorizedError') {
        return apiErrorRes(req, res, "Send valid token!!!", CONSTANT.DATA_NULL, CONSTANT.INVALID_TOKEN);
    }
    return apiErrorRes(req, res, err.message);

}
module.exports = errorHandler;