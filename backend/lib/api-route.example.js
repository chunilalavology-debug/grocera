/**
 * Example Express handler pattern for Vercel serverless:
 * - await connectDB() before queries
 * - try/catch with JSON error responses
 * - use .limit(), .select(), .lean() to keep payloads small
 *
 * Copy into a controller or `router.get("/path", handler)`.
 */

const { connectDB } = require("./db");

async function examplePaginatedList(req, res) {
  try {
    await connectDB();

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const ExampleModel = require("../db/models/Product");
    const items = await ExampleModel.find({ isDeleted: false })
      .select("name price image category")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (err) {
    console.error("examplePaginatedList:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
}

module.exports = { examplePaginatedList };
