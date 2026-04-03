const path = require("path");
const fs = require("fs");
const winston = require("winston");

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const isVercel = Boolean(process.env.VERCEL);
// Vercel serverless: only /tmp is writable; relative "logs/" causes ENOENT on mkdir.
const logsDir = isVercel
    ? path.join("/tmp", "logs")
    : path.join(__dirname, "..", "..", "logs");

try {
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
} catch (_) {
    /* winston File transport may still fail; console-only path below covers Vercel */
}

const transports = [];

if (fs.existsSync(logsDir)) {
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

// Dev: colorized console. Production on Vercel (or if file logs unavailable): console for runtime output.
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: combine(colorize(), logFormat),
        })
    );
} else if (isVercel || transports.length === 0) {
    logger.add(
        new winston.transports.Console({
            format: combine(logFormat),
        })
    );
}

module.exports = logger;
