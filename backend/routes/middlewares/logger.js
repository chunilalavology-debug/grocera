const winston = require("winston");

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        // 🔴 Error log file
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
        }),

        // 🧾 All logs
        new winston.transports.File({
            filename: "logs/combined.log",
        }),
    ],
});

// 🌈 Console logs only in dev
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: combine(colorize(), logFormat),
        })
    );
}

module.exports = logger;
