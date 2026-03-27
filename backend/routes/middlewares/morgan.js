const morgan = require("morgan");
const logger = require("./logger.js");

// IP token
morgan.token("ip", (req) =>
    req.headers["x-forwarded-for"] || req.socket.remoteAddress
);

// User token
morgan.token("user", (req) => req.user?.email || "guest");

// ⏱ Slow request detector
morgan.token("slow", (req, res) => {
    const time = res.getHeader("X-Response-Time");
    return time && Number(time) > 500 ? "⚠️ SLOW" : "";
});

exports.morganMiddleware = morgan(
    ":method :url :status :response-time ms :slow | :ip | :user",
    {
        stream: {
            write: (message) => {
                logger.info(message.trim());
            },
        },
    }
);
