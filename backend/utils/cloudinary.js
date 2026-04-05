const cloudinary = require("cloudinary").v2;
let { resultDb } = require('./globalFunction');
const { DATA_NULL, SUCCESS, SERVER_ERROR } = require('./constants');
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({
  path: "./.env",
});

cloudinary.config({
  cloud_name: process.env.CLOUDNARY_CLOUD_NAME,
  api_key: process.env.CLOUDNARY_API_KEY,
  api_secret: process.env.CLOUDNARY_API_SECRET
});

const uploadCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload_stream(localFilePath, {
      resource_type: "auto",
      folder: 'your_folder_name'
    });
    return resultDb(SUCCESS, response)
  } catch (error) {
    try {
      if (localFilePath) fs.unlinkSync(localFilePath);
    } catch (_) {
      /* ignore */
    }
    console.error("uploadCloudinary:", error?.message || error);
    return resultDb(SERVER_ERROR, DATA_NULL)
  }
};

module.exports = uploadCloudinary;
