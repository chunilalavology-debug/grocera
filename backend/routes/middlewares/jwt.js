const { expressjwt: jwt } = require("express-jwt");
const { apiErrorRes } = require("../../utils/globalFunction");
const { INVALID_TOKEN, DATA_NULL } = require("../../utils/constants");
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const API_END_POINT_V1 = String(process.env.API_END_POINT_V1 || "/api").replace(
  /\/+$/,
  ""
) || "/api";

const endpoints = [
  'auth/login',
  'auth/register',
  'auth/forgetPasswordSendMail',
  'auth/forgotPassword',
  'auth/resetPassword',
  'auth/verifyEmail',

  'user/products',
  'orders/webhook',
  'user/contactForm',
  'user/products/getById',
  'user/categories',
  'user/getCategories',
  'products/list',
  'deals/list',
  'voucher/redeem',
  'subscription/subscribe',
  'uploadImage'
];
const pathFreeArray = endpoints.map(
  (endpoint) => `${API_END_POINT_V1}/${endpoint}`
);

module.exports = () => {
  return (req, res, next) => {
    jwt({
      secret: JWT_SECRET_KEY,
      algorithms: ["HS256"],
      credentialsRequired: true,
      requestProperty: "user",
    }).unless({
      path: pathFreeArray,
    })(req, res, (err) => {
      let obj = {
        path: req.url,
        time: new Date(),
        // userId : req.user._id
      };

      if (err) {
        if (err.name === "UnauthorizedError") {
          return apiErrorRes(
            req,
            res,
            "Send valid token!",
            DATA_NULL,
            INVALID_TOKEN
          );
        } else {
          return apiErrorRes(req, res, "Internal server error", DATA_NULL);
        }
      }
      next();
    });
  };
};
