const { apiErrorRes } = require('../../utils/globalFunction');
const { INVALID_TOKEN, DATA_NULL, ACCESS_DENIED, SUCCESS } = require('../../utils/constants');
const { JWT_SECRET_KEY } = process.env;
const serviceRedis = require('../services/serviceRedis')


function hasPermissionAdminRedis() {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      const redisData = await serviceRedis.getKey('_TOKENADMIN' + userId)
      const authToken = req.headers.authorization?.split(' ')[1];

      const redisToken = JSON.parse(redisData.data)

      // Compare tokens
      if (!redisToken || !authToken || redisToken.toString() !== authToken.toString()) {
        return apiErrorRes(req, res, 'Invalid or expired token.', 'Unauthorized', 401);
      }

      const adminDetials = await serviceAdmin.getAdminById(userId);

      if (adminDetials.statusCode !== SUCCESS) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      if (adminDetials.data) {
        return next();
      }

      return apiErrorRes(req, res, 'Access denied. Not an Admin.', 'Unauthorized', 401);

    } catch (error) {
      console.error('Error in hasPermissionAdminRedis middleware:', error);
      return apiErrorRes(req, res, "Internal server error", DATA_NULL, ACCESS_DENIED);
    }
  };
}

function hasPermissionUser() {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      const redisToken = await serviceRedis.getKey('_TOKEN' + userId)
      const authToken = req.headers.authorization?.split(' ')[1];

      // Compare tokens
      if (!redisToken || !authToken || redisToken !== authToken) {
        return apiErrorRes(req, res, 'Invalid or expired token.', 'Unauthorized', 401);
      }

      const adminDetials = await serviceUserInfo.getByUserId({ userId: userId });

      if (adminDetials.statusCode !== SUCCESS) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      if (adminDetials.data.userType === 'TRAVELLER') {
        return next(); // ✅ Add return here to prevent further execution
      }

      return apiErrorRes(req, res, 'Access denied. Not an Traveller.', 'Unauthorized', 401);

    } catch (error) {
      console.error('Error in hasPermissionAdminRedis middleware:', error);
      return apiErrorRes(req, res, "Internal server error", DATA_NULL, ACCESS_DENIED);
    }
  };
}

function hasPermissionProtectedRoute(roles, routes = []) {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      if (!userId) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      const redisData = await serviceRedis.getKey('_TOKENADMIN' + userId)
      const authToken = req.headers.authorization?.split(' ')[1];

      const redisToken = JSON.parse(redisData.data)

      // Compare tokens
      if (!redisToken || !authToken || redisToken.toString() !== authToken.toString()) {
        return apiErrorRes(req, res, 'Invalid or expired token.', 'Unauthorized', 401);
      }

      const adminDetials = await serviceAdmin.getAdminById(userId);

      if (adminDetials.statusCode !== SUCCESS || !adminDetials.data) {
        return apiErrorRes(req, res, 'User information missing.', 'Unauthorized', 401);
      }

      const adminAccess = adminDetials.data?.access?.page || []
      const isAnyMatch = routes.some(value => adminAccess.includes(value));
      const userRole = adminDetials.data?.role;
      const isTeamLeader = adminDetials.data?.teamLeader;

      if (
        adminDetials.data.role === 'admin' ||
        (
          roles === userRole &&
          (isAnyMatch || isTeamLeader)
        )
      ) {
        return next();
      }
      return apiErrorRes(req, res, 'Access denied. Not an Admin.', 'Unauthorized', 401);

    } catch (error) {
      console.error('Error in hasPermissionAdminRedis middleware:', error);
      return apiErrorRes(req, res, "Internal server error", DATA_NULL, ACCESS_DENIED);
    }
  };
}

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user role is in allowed roles
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};


module.exports = { hasPermissionAdminRedis, hasPermissionUser, hasPermissionProtectedRoute, authorize };
