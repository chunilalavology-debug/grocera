const { expressjwt: jwt } = require("express-jwt");
const jwtLib = require("jsonwebtoken");
const { INVALID_TOKEN, DATA_NULL } = require("../../utils/constants");

let API_END_POINT_V1 =
  String(process.env.API_END_POINT_V1 || "/api").replace(/\/+$/, "") || "/api";
if (!API_END_POINT_V1.startsWith("/")) {
  API_END_POINT_V1 = `/${API_END_POINT_V1}`;
}
const A = API_END_POINT_V1;

/** Collapse duplicate slashes and trim trailing slash so Vercel/proxies match public route allowlists. */
function normalizeJwtPathname(p) {
  let s = String(p || "")
    .split("?")[0]
    .trim();
  if (!s) s = "/";
  if (!s.startsWith("/")) s = `/${s}`;
  s = s.replace(/\/+/g, "/");
  if (s.length > 1) s = s.replace(/\/$/, "");
  return s;
}

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
  return normalizeJwtPathname(pathname);
}

/**
 * Paths that never require a Bearer token.
 * Use exact pathname (no query string). Keep in sync with storefront + auth flows.
 */
function isPublicJwtPath(req) {
  const pathname = pathnameForJwt(req);
  const m = req.method.toUpperCase();

  if (pathname === normalizeJwtPathname(`${A}/health`)) return true;

  if (pathname === normalizeJwtPathname(`${A}/orders/webhook`) && m === "POST") return true;

  if (pathname.startsWith("/verify-session/")) return true;

  if (pathname.startsWith("/api/v1/upload")) return true;

  const publicAuth = new Set(
    [
      `${A}/auth/login`,
      `${A}/auth/register`,
      `${A}/auth/forgetPasswordSendMail`,
      `${A}/auth/resetpassword`,
      `${A}/auth/forgotPassword`,
      `${A}/auth/resetPassword`,
      `${A}/auth/verifyEmail`,
    ].map(normalizeJwtPathname),
  );
  if (publicAuth.has(pathname)) return true;

  const publicUserReads = new Set(
    [
      `${A}/user/products`,
      `${A}/user/products/getById`,
      `${A}/user/categories`,
      `${A}/user/getCategories`,
      `${A}/user/featured-categories`,
      `${A}/user/home-slider-settings`,
      `${A}/user/site-settings`,
      `${A}/user/referral/discount`,
    ].map(normalizeJwtPathname),
  );
  if (publicUserReads.has(pathname)) return true;

  if (pathname === normalizeJwtPathname(`${A}/settings`) && m === "GET") return true;

  if (pathname === normalizeJwtPathname(`${A}/user/contactForm`) && m === "POST") return true;

  /** Guest checkout — body must include shipping `address`; logged-in users send addressId + Bearer token */
  if (pathname === normalizeJwtPathname(`${A}/user/orderPayment`) && m === "POST") return true;

  /**
   * Zippyyy Ships (public iframe / storefront) — quote + checkout can run without login; optional Bearer still attaches req.user.
   */
  if (pathname === normalizeJwtPathname(`${A}/user/shipping/quote`) && m === "POST") return true;
  if (pathname === normalizeJwtPathname(`${A}/user/shipping/checkout`) && m === "POST") return true;

  /** Order confirmation page — signed token from checkout (guests have no JWT) */
  if (pathname === normalizeJwtPathname(`${A}/user/orderByViewToken`) && m === "GET") return true;

  if (pathname === normalizeJwtPathname(`${A}/products/list`)) return true;
  if (pathname === normalizeJwtPathname(`${A}/deals/list`)) return true;
  if (pathname === normalizeJwtPathname(`${A}/voucher/redeem`) && m === "POST") return true;
  if (pathname === normalizeJwtPathname(`${A}/subscription/subscribe`) && m === "POST") return true;

  return false;
}

/**
 * Public checkout routes: if a valid Bearer token is sent, attach req.user so logged-in customers
 * keep account-linked behavior (grocery addressId / shipping saved address path).
 */
function attachUserFromBearerForOrderPayment(req, res, next) {
  const pathname = pathnameForJwt(req);
  const m = req.method.toUpperCase();
  const isOrderPayment =
    pathname === normalizeJwtPathname(`${A}/user/orderPayment`) && m === "POST";
  const isShippingCheckout =
    pathname === normalizeJwtPathname(`${A}/user/shipping/checkout`) && m === "POST";
  if (!isOrderPayment && !isShippingCheckout) {
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
        const jwtAuthNames = new Set([
          "UnauthorizedError",
          "JsonWebTokenError",
          "TokenExpiredError",
          "NotBeforeError",
        ]);
        if (
          jwtAuthNames.has(err.name) ||
          err.code === "credentials_required" ||
          err.code === "invalid_token"
        ) {
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
