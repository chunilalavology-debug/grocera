// tokenUtils.js
const jwt = require("jsonwebtoken");
const { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY, JWT_EXPIRE } = process.env;

// Function to sign a token
const signToken = (payload, expiresIn = "365d") => {
    return jwt.sign(payload, "CJsywCDHTtCJsywCJsywCDHTtCJsyw", { expiresIn: expiresIn });
};

// Middleware to generate a refresh token
const generateRefreshToken = (payload, expiresIn = "365d") => {
    return jwt.sign(payload, "CJsywCDHTtCJsywCJsywCDHTtCJsywREFRESH", { expiresIn: expiresIn });
}

module.exports = { signToken, generateRefreshToken };