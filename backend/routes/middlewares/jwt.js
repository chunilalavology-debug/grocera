const { expressjwt: jwt } = require("express-jwt");
const { apiErrorRes } = require("../../utils/globalFunction");
const { INVALID_TOKEN, DATA_NULL } = require("../../utils/constants");
const { JWT_SECRET_KEY, API_END_POINT_V1 } = process.env;

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
const normalizePath = (p = "") => {
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  const trimmed = withSlash.replace(/\/+$/, "");
  return trimmed || "/";
};

const apiBase = normalizePath(API_END_POINT_V1 || "/api");
const publicPathSet = new Set(
  endpoints.flatMap((endpoint) => {
    const ep = normalizePath(endpoint);
    return [normalizePath(`${apiBase}${ep}`), ep];
  })
);

const isPublicPath = (pathName = "") => publicPathSet.has(normalizePath(pathName));
let warnedMissingJwtSecret = false;

module.exports = () => {
  return (req, res, next) => {
    if (!JWT_SECRET_KEY || typeof JWT_SECRET_KEY !== "string" || JWT_SECRET_KEY.trim().length === 0) {
      if (!warnedMissingJwtSecret) {
        warnedMissingJwtSecret = true;
        console.error("JWT_SECRET_KEY is missing. Protected routes will return 503 until configured.");
      }

      if (isPublicPath(req.path)) return next();

      return res.status(503).json({
        success: false,
        message: "Server auth configuration missing (JWT_SECRET_KEY)",
      });
    }

    jwt({
      secret: JWT_SECRET_KEY,
      algorithms: ["HS256"],
      credentialsRequired: true,
      requestProperty: "user",
    }).unless({
      custom: (req) => isPublicPath(req.path),
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
