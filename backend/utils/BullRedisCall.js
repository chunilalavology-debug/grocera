const Queue = require('bull');
const notificationQueue = new Queue('notificationQueue', { redis: { host: '127.0.0.1', port: 6379 } });


module.exports = {
    notificationQueue
}