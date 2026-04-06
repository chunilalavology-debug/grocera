import axios from "axios";
import { getApiBaseUrl } from "../config/apiBase";

/** Cloudinary routes in `backend/app.js` are under `/api/v1/` (not the same prefix as `services/api.js` paths). */
const BACKEND_URL = `${getApiBaseUrl().replace(/\/+$/, "")}/v1/`;


/**
 * Universal API request handler
 */
export const axiosRequest = async (
  method = "get" || "post" || "put" || "delete",
  url,
  data = {},
  headers = {},
  isFile = false
) => {
  try {
    const config = {
      method,
      url: `${BACKEND_URL}${url}`,
      headers: {
        ...(isFile ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(method === "get"
        ? { params: data }
        : { data: isFile ? data : JSON.stringify(data) }),
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      let message = "Request failed";

      if (error.response) {
        message =
          error.response.data?.message || `Error ${error.response.status}`;
      } else if (error.request) {
        message =
          "Network error: Unable to reach the server. Please check your connection.";
      } else if (error.code === "ECONNABORTED") {
        message = "Request timed out. Please try again.";
      } else {
        message = error.message || "Unexpected request error";
      }

      throw {
        isAxiosError: true,
        message,
        status: error.response?.status || null,
      };
    }

    throw { isAxiosError: false, message: "Unexpected error occurred" };
  }
};

export const uploadFiles = async ({
  files,
  endpoint = "/uploadMultipleImages",
  fieldName = "files",
}) => {
  if (!files.length) throw new Error("No files selected");

  const formData = new FormData();
  files.forEach((file) => formData.append(fieldName, file));

  try {
    const res = await axios.post(`${BACKEND_URL}${endpoint}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  } catch (err) {
    let message = "Upload failed. Please try again.";

    if (axios.isAxiosError(err)) {
      message = err.response?.data?.message || err.message || message;
    } else if (err instanceof Error) {
      message = err.message;
    }

    if (process.env.NODE_ENV === "development") console.error("Upload error:", message);
    throw new Error(message);
  }
};
