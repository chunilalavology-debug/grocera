const moment = require('moment');

function addTimeStamp() {
    return {
        isDisable: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        date: {
            type: Number,
            default: () => moment().startOf('day').valueOf()
        },
        month: {
            type: Number,
            default: () => moment().startOf('month').valueOf()
        },
        year: {
            type: Number,
            default: () => moment().startOf('year').valueOf()
        },
        createdAt: {
            type: Number,
            default: Date.now
        },
        updatedAt: {
            type: Number,
            default: Date.now
        },
    };
}

module.exports = {
    addTimeStamp
};
