import axios from "axios";
import { getApiBaseUrl } from "../config/apiBase";

const MAX_ERROR_LEN = 240;

function clipErrorText(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.startsWith("<!DOCTYPE") || /<html[\s>]/i.test(t)) {
    return (
      "API call returned a web page (wrong base URL). Set REACT_APP_API_URL to your backend …/api and rebuild. " +
      "If /api is on this same site, set REACT_APP_SAME_ORIGIN_API=1."
    );
  }
  return t.length > MAX_ERROR_LEN ? `${t.slice(0, MAX_ERROR_LEN - 1)}…` : t;
}

const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: isLocal ? 20_000 : 55_000,
});

function isAuthLoginOrRegisterUrl(config) {
  const path = String(config?.url || "").split("?")[0];
  return path === "/auth/login" || path === "/auth/register";
}

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    /** Ask intermediaries not to serve stale catalog JSON (featured categories, product lists, etc.). */
    const method = String(config.method || "get").toLowerCase();
    const path = String(config.url || "").split("?")[0];
    if (
      method === "get" &&
      (path === "/user/featured-categories" ||
        path === "/user/getCategories" ||
        path === "/user/categories" ||
        path === "/user/products" ||
        path === "/settings" ||
        path === "/user/site-settings" ||
        path === "/user/home-slider-settings" ||
        path === "/admin/home-slider-settings")
    ) {
      config.headers = config.headers || {};
      if (!config.headers["Cache-Control"]) config.headers["Cache-Control"] = "no-cache";
      if (!config.headers.Pragma) config.headers.Pragma = "no-cache";
    }
    const token = localStorage.getItem("token");
    /** Do not send a stale JWT on credential POSTs — avoids odd 401 / middleware edge cases. */
    if (token && !isAuthLoginOrRegisterUrl(config)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Authorization");
      } else {
        delete config.headers.Authorization;
      }
    }
    /** Let the browser set multipart boundary; a bare "multipart/form-data" header breaks multer. */
    if (typeof FormData !== "undefined" && config.data instanceof FormData && config.headers) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
        config.headers.delete("content-type");
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const data = response.data;
    const code = data && (data.code ?? data.Code);
    if (data && data.error === true && Number(code) === 3) {
      localStorage.removeItem("token");
      localStorage.removeItem("demoUser");
      return Promise.reject({
        status: 401,
        message: data.message || "Authentication required",
      });
    }
    return data;
  },
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    /** Failed login/register also returns 401 — do not wipe the session for those. */
    const reqUrl = String(error?.config?.url || "").split("?")[0];
    const isCredentialAttempt =
      reqUrl === "/auth/login" || reqUrl === "/auth/register";
    if (status === 401 && !isCredentialAttempt) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Authentication expired or invalid token.");
      }
      localStorage.removeItem("token");
      localStorage.removeItem("demoUser");
    }

    let fromBody = "";
    if (data && typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim()) fromBody = data.message.trim();
      else if (typeof data.error === "string" && data.error.trim()) fromBody = data.error.trim();
    } else if (typeof data === "string" && data.trim()) {
      fromBody = data.trim();
    }

    if (
      typeof fromBody === "string" &&
      /Error occurred while trying to proxy/i.test(fromBody)
    ) {
      fromBody =
        "Backend not reachable. Start the API (cd grocera/backend, npm start). Default port is 5000. If you use another port, set REACT_APP_API_URL=http://127.0.0.1:YOUR_PORT/api in frontend/.env.local and restart npm start.";
    }

    const message = clipErrorText(
      fromBody ||
        (status === 413 ? "File or request too large for the server." : "") ||
        (status === 403 ? "You do not have permission for this action." : "") ||
        error?.message ||
        "Something went wrong"
    );

    return Promise.reject({
      status,
      message: message || "Something went wrong",
    });
  }
);

export default api;
export { getApiBaseUrl };
