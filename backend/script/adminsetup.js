require('dotenv').config();
const { Admin } = require('../db');
const { ROLES } = require('../utils/roles');
adminCreate = async () => {
    let data = {
        userName: "admin",
        password: "123456",
    }
    try {
        let testUser = new Admin(data);
        let res = await testUser.save();
        console.log(res);
        process.exit(0);
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
}
(async () => {
    await adminCreate();
})();
