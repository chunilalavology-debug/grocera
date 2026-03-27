const { resultDb } = require("../../utils/globalFunction");
const { DATA_NULL, SUCCESS, SERVER_ERROR, NOT_FOUND } = require('../../utils/constants');
const { Service, ServiceCategory } = require("../../db");
const ServiceUsers = require("../../db/models/ServiceUsers");

const saveService = async (data) => {
    try {
        const save = await Service.create(data);
        return resultDb(SUCCESS, save)
    } catch (error) {
        console.error('err: saveService ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const getServiceById = async (data) => {
    try {
        const get = await Service.findOne(data);
        if (!get) return resultDb(NOT_FOUND, null)
        return resultDb(SUCCESS, get)
    } catch (error) {
        console.error('err: getServiceById ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const getServiceList = async (data) => {
    try {
        const query = {};

        if (data?.status) {
            query.status = data.status
        }

        if (data?.serviceId) {
            query['serviceType'] = data?.serviceId
        }

        if (data?.search) {
            query['$or'] = [
                {
                    name: {
                        $regex: data.search,
                        $options: "i"
                    }
                },
                {
                    email: {
                        $regex: data.search,
                        $options: "i"
                    }
                },
                {
                    phone: {
                        $regex: data.search
                    }
                },
            ]
        }
        const limit = data.size || 50;
        const page = data.pageNo || 1
        const skip = (page - 1) * limit

        const total = await Service.countDocuments(query);
        const list = await Service.find(query)
            .populate('serviceType', "name")
            .sort('-createdAt')
            .limit(limit).skip(skip).lean();

        if (!list) return resultDb(NOT_FOUND, null)
        return resultDb(SUCCESS, { list, total })

    } catch (error) {
        console.error('err: getServiceList ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const saveServiceCategory = async (data) => {
    try {
        const save = await ServiceCategory.create(data);
        return resultDb(SUCCESS, save)
    } catch (error) {
        console.error('err: saveServiceCategory ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const editServiceCategory = async (data) => {
    try {
        const save = await ServiceCategory.findByIdAndUpdate(data?.id, data);
        if (!save) resultDb(NOT_FOUND, DATA_NULL)
        return resultDb(SUCCESS, save)
    } catch (error) {
        console.error('err: editServiceCategory ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const getServicCategoryeById = async (data) => {
    try {
        const get = await ServiceCategory.findOne(data);
        if (!get) return resultDb(NOT_FOUND, null)
        return resultDb(SUCCESS, get)
    } catch (error) {
        console.error('err: getServicCategoryeById ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

const getServiceCategoryList = async (data) => {
    try {
        const query = {};

        if (data?.status === 'Active') {
            query.isDisable = false
        } else if (data.status === "inactive") {
            query.isDisable = true
        }

        if (data?.search) {
            query.name = {
                $regex: data.name,
                $options: "i"
            }
        }
        const limit = data.size || 50;
        const page = data.pageNo || 1
        const skip = (page - 1) * limit

        const total = await ServiceCategory.countDocuments(query);
        const list = await ServiceCategory.find(query)
            .sort('-createdAt')
            .limit(limit)
            .skip(skip);

        if (!list) return resultDb(NOT_FOUND, null)
        return resultDb(SUCCESS, { list, total })
    } catch (error) {
        console.error('err: getServiceCategoryList ', error)
        return resultDb(SERVER_ERROR, null)
    }
}

/* ================= SAVE SERVICE ================= */
const saveUserService = async (data) => {
    try {
        const save = await ServiceUsers.create(data);
        return resultDb(SUCCESS, save);
    } catch (error) {
        console.error("err: saveUserService", error);
        return resultDb(SERVER_ERROR, null);
    }
};

/* ================= GET SERVICE BY ID ================= */
const getUserServiceById = async (data) => {
    try {
        const get = await ServiceUsers.findOne(data)
            .populate("serviceType", "name")
            .populate("serviceBoy", "name phone image");

        if (!get) return resultDb(NOT_FOUND, null);
        return resultDb(SUCCESS, get);
    } catch (error) {
        console.error("err: getUserServiceById", error);
        return resultDb(SERVER_ERROR, null);
    }
};

/* ================= GET SERVICE LIST ================= */
const getUserServiceList = async (data) => {
    try {
        const query = {};

        // 🔹 status filter
        if (data?.status) {
            query.status = data.status;
        }

        if (data?.userId) {
            query.userId = data.userId;
        }

        // 🔹 serviceType filter
        if (data?.serviceType) {
            query.serviceType = data.serviceType;
        }

        // 🔹 search filter
        if (data?.search) {
            query.$or = [
                { name: { $regex: data.search, $options: "i" } },
                { phone: { $regex: data.search, $options: "i" } },
                { message: { $regex: data.search, $options: "i" } },
            ];
        }

        const limit = Number(data.size) || 100;
        const page = Number(data.pageNo) || 1;
        const skip = (page - 1) * limit;

        const total = await ServiceUsers.countDocuments(query);

        const list = await ServiceUsers.find(query)
            .populate("serviceType", "name image")
            .populate("serviceBoy", "name phone image")
            .populate("userId", "name phone email image")
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        return resultDb(SUCCESS, { list, total });
    } catch (error) {
        console.error("err: getUserServiceList", error);
        return resultDb(SERVER_ERROR, null);
    }
};

/* ================= UPDATE SERVICE STATUS ================= */
const updateUserServiceStatus = async ({ id, status }) => {
    try {
        const update = await ServiceUsers.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!update) return resultDb(NOT_FOUND, null);
        return resultDb(SUCCESS, update);
    } catch (error) {
        console.error("err: updateUserServiceStatus", error);
        return resultDb(SERVER_ERROR, null);
    }
};




module.exports = {
    saveService,
    getServiceById,
    getServiceList,
    saveServiceCategory,
    editServiceCategory,
    getServicCategoryeById,
    getServiceCategoryList,
    saveUserService,
    getUserServiceById,
    getUserServiceList,
    updateUserServiceStatus,
}