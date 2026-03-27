const winston = require("winston");
const fs = require("fs");
const path = require("path");

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const isVercel = Boolean(process.env.VERCEL);
const transports = [];

if (!isVercel) {
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
        }),
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
        })
    );
}

const logger = winston.createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat
    ),
    transports,
});

// Keep console logs on Vercel and non-production environments.
if (isVercel || process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: combine(colorize(), logFormat),
        })
    );
}

module.exports = logger;
