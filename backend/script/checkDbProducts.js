require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.DB_STRING || process.env.MONGO_URI;
  if (!uri) {
    console.error("No DB_STRING / MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const col = mongoose.connection.db.collection("products");
  const total = await col.countDocuments({});
  const visible = await col.countDocuments({ inStock: true, isDeleted: false });
  const sample = await col.find({}).limit(5).project({ name: 1, inStock: 1, isDeleted: 1, quantity: 1 }).toArray();
  console.log(JSON.stringify({ dbName: mongoose.connection.db.databaseName, total, storefrontVisible: visible, sample }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
