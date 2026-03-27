const serviceAccount = require('./serviceAccount.json')
const admin = require("firebase-admin");

let createFirebaseUser = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = createFirebaseUser;

