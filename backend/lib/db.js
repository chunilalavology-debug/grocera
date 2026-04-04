/**
 * MongoDB connection for Node serverless (Vercel).
 * Uses global caching so warm Lambdas reuse a single Mongoose connection.
 *
 * Env: set `MONGO_URI` (preferred) or legacy `DB_STRING`.
 * URI must include the database name, e.g.
 * mongodb+srv://user:pass@cluster.xxx.mongodb.net/mydb?retryWrites=true&w=majority
 */

const mongoose = require("mongoose");

const MONGOOSE_OPTS = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  socketTimeoutMS: 45_000,
};

/** @type {{ conn: import('mongoose').Connection | null, promise: Promise<typeof mongoose> | null }} */
let cached = global.__mongoose;

if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

/**
 * Resolve Atlas / local URI. Prefer MONGO_URI; fall back to DB_STRING for existing deploys.
 */
function getMongoUri() {
  const uri = process.env.MONGO_URI || process.env.DB_STRING;
  if (!uri || typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Returns mongoose connection after ensuring TCP + auth are ready.
 * Safe to await on every request (O(1) when already connected).
 */
async function connectDB() {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error(
      "Missing MONGO_URI (or DB_STRING). Include the database name in the path, e.g. ...mongodb.net/mydb?retryWrites=true&w=majority"
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // db/index.js or a prior request may have already called mongoose.connect() (readyState 2).
  if (mongoose.connection.readyState === 2 && typeof mongoose.connection.asPromise === "function") {
    await mongoose.connection.asPromise();
    return mongoose.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, MONGOOSE_OPTS).then(() => mongoose);
  }

  try {
    await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return mongoose.connection;
}

/** Mongoose readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting */
function getConnectionState() {
  return mongoose.connection.readyState;
}

function getDatabaseName() {
  return mongoose.connection?.db?.databaseName ?? null;
}

module.exports = {
  connectDB,
  getMongoUri,
  getConnectionState,
  getDatabaseName,
  mongoose,
};
