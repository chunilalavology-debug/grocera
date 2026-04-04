const { expressjwt: jwt } = require("express-jwt");
const jwtLib = require("jsonwebtoken");
const { INVALID_TOKEN, DATA_NULL } = require("../../utils/constants");

const API_END_POINT_V1 =
  String(process.env.API_END_POINT_V1 || "/api").replace(/\/+$/, "") || "/api";
const A = API_END_POINT_V1;

const isProd = process.env.NODE_ENV === "production";
/** Must match `Users` model token signing when JWT_SECRET_KEY is unset. */
const DEV_JWT_FALLBACK = "fallback-secret-key";
const JWT_SECRET_KEY =
  process.env.JWT_SECRET_KEY || (!isProd ? DEV_JWT_FALLBACK : null);

if (!JWT_SECRET_KEY) {
  console.error("JWT_SECRET_KEY is required in production. Set it in backend/.env");
  process.exit(1);
}

function pathnameForJwt(req) {
  let pathname = String(req.originalUrl || req.url || "").split("?")[0];
  const base = A.endsWith("/") ? A.slice(0, -1) : A;
  if (
    pathname &&
    !pathname.startsWith("/api") &&
    /^\/(user|auth)\b/.test(pathname)
  ) {
    pathname = `${base}${pathname}`;
  }
  return pathname;
}

/**
 * Paths that never require a Bearer token.
 * Use exact pathname (no query string). Keep in sync with storefront + auth flows.
 */
function isPublicJwtPath(req) {
  const pathname = pathnameForJwt(req);
  const m = req.method.toUpperCase();

  if (pathname === `${A}/health`) return true;

  if (pathname === `${A}/orders/webhook` && m === "POST") return true;

  if (pathname.startsWith("/verify-session/")) return true;

  if (pathname.startsWith("/api/v1/upload")) return true;

  const publicAuth = new Set([
    `${A}/auth/login`,
    `${A}/auth/register`,
    `${A}/auth/forgetPasswordSendMail`,
    `${A}/auth/resetpassword`,
    `${A}/auth/forgotPassword`,
    `${A}/auth/resetPassword`,
    `${A}/auth/verifyEmail`,
  ]);
  if (publicAuth.has(pathname)) return true;

  const publicUserReads = new Set([
    `${A}/user/products`,
    `${A}/user/products/getById`,
    `${A}/user/categories`,
    `${A}/user/getCategories`,
    `${A}/user/featured-categories`,
    `${A}/user/home-slider-settings`,
    `${A}/user/referral/discount`,
  ]);
  if (publicUserReads.has(pathname)) return true;

  if (pathname === `${A}/user/contactForm` && m === "POST") return true;

  /** Guest checkout — body must include shipping `address`; logged-in users send addressId + Bearer token */
  if (pathname === `${A}/user/orderPayment` && m === "POST") return true;

  if (pathname === `${A}/products/list`) return true;
  if (pathname === `${A}/deals/list`) return true;
  if (pathname === `${A}/voucher/redeem` && m === "POST") return true;
  if (pathname === `${A}/subscription/subscribe` && m === "POST") return true;

  return false;
}

/**
 * POST /api/user/orderPayment is public (guest checkout). If a valid Bearer token is sent,
 * attach req.user so logged-in customers still use addressId + referral logic.
 */
function attachUserFromBearerForOrderPayment(req, res, next) {
  const pathname = pathnameForJwt(req);
  if (pathname !== `${A}/user/orderPayment` || req.method.toUpperCase() !== "POST") {
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== "string" || !/^Bearer\s+\S+/i.test(auth)) {
    return next();
  }
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  try {
    const decoded = jwtLib.verify(token, JWT_SECRET_KEY);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch (_) {
    /* invalid/expired token — proceed as guest */
  }
  next();
}

function createJwtMiddleware() {
  return (req, res, next) => {
    jwt({
      secret: JWT_SECRET_KEY,
      algorithms: ["HS256"],
      credentialsRequired: true,
      requestProperty: "user",
    }).unless({
      custom: isPublicJwtPath,
    })(req, res, (err) => {
      if (err) {
        if (err.name === "UnauthorizedError") {
          return res.status(401).json({
            success: false,
            error: true,
            code: INVALID_TOKEN,
            message: "Authentication required. Please sign in again.",
            data: DATA_NULL,
          });
        }
        return res.status(500).json({
          success: false,
          error: true,
          message: err.message || "Internal server error",
        });
      }
      next();
    });
  };
}

createJwtMiddleware.attachUserFromBearerForOrderPayment =
  attachUserFromBearerForOrderPayment;
module.exports = createJwtMiddleware;
