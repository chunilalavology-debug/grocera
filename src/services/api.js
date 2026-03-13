import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';

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
