import axios from 'axios';

const getDefaultApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
  }

  return 'https://zippyyy.com/api';
};

const API_URL = getDefaultApiUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
