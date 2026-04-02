import axios from "axios";
import { getApiBaseUrl } from "../config/apiBase";

const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: isLocal ? 20_000 : 55_000,
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      console.warn("Authentication expired or invalid token.");
      localStorage.removeItem("token");
      localStorage.removeItem("demoUser");
    }

    return Promise.reject({
      status,
      message: error?.response?.data?.message || "Something went wrong",
    });
  }
);

export default api;
export { getApiBaseUrl };
