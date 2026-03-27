let CONSTANTS = require("./constants");
const User = require("../db/models/User")

const generateReferralCode = async (length = CONSTANTS.REFERRAL_CODE_LENGTH) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        if (i < 4) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        } else {
            code += Math.floor(Math.random() * 10);
        }
    }
    let existingUser = await User.findOne({ refCode: code });
    while (existingUser) {
        code = '';
        for (let i = 0; i < length; i++) {
            if (i < 4) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            } else {
                code += Math.floor(Math.random() * 10);
            }
        }
        existingUser = await User.findOne({ referralCode: code });
    }
    return code;
};

const generateKey = (length = CONSTANTS.VERIFICATION_TOKEN_LENGTH) => {
    var key = "";
    var possible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (var i = 0; i < length; i++) {
        key += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return key;
}

const generateOTP = (length = CONSTANTS.OTP_LENGTH) => {
    var key = "";
    var possible = "0123456789";
    for (var i = 0; i < length; i++) {
        key += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return key;
}


module.exports = {
    generateReferralCode: generateReferralCode,
    generateOTP: generateOTP,
    generateKey: generateKey
};