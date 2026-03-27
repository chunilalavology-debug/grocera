require('dotenv').config();
const express = require('express');
const multer = require('multer')
const { apiErrorRes, apiSuccessRes } = require('./globalFunction')
const cloudinary = require("cloudinary").v2;
const path = require('path');
const http = require('http');
const dir = path.join(__dirname, '/upload');
const streamifier = require("streamifier")
const { PORT, API_END_POINT_V1, CLOUDNARY_CLOUD_NAME,
    CLOUDNARY_API_KEY,
    CLOUDNARY_API_SECRET } = process.env;


cloudinary.config({
    cloud_name: CLOUDNARY_CLOUD_NAME,
    api_key: CLOUDNARY_API_KEY,
    api_secret: CLOUDNARY_API_SECRET
});

function uploadToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'image' },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}
async function uploadImage(req, res) {
    if (!req.files) {
        return res.status(400).send('No file uploaded.');
    }
    try {
        const result = await uploadToCloudinary(req.files[0].buffer);
        return apiSuccessRes(req, res, "SUCCESS.", {
            imageName: req.files[0].originalname,
            imageUrl: result.secure_url
        })
    } catch (error) {
        apiErrorRes(req, res, 'Error uploading image.', null);
    }
}

module.exports = { uploadImage }