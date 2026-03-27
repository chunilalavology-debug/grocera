// Assuming you have set MAINTENANCE as an environment variable
const { MAINTENANCE } = process.env;
const { apiErrorRes } = require('../../utils/globalFunction');
const { MAINTENANCE_STATUS, DATA_NULL } = require('../../utils/constants');

// Middleware to check maintenance mode
function maintenance(req, res, next) {
    // Check if maintenance mode is enabled
    if (MAINTENANCE && MAINTENANCE.toLowerCase() === 'true') {
        return apiErrorRes(req, res, 'Service temporarily unavailable due to maintenance.', DATA_NULL, MAINTENANCE_STATUS);
    }
    // Continue to the next middleware or route handler
    next();
}

module.exports = { maintenance };
