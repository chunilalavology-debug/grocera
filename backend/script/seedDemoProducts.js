/**
 * Inserts a few in-stock demo products if the collection is empty.
 * Run from backend/: node script/seedDemoProducts.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Product = require("../db/models/Product");

const demos = [
  {
    name: "Demo Apples",
    description: "Fresh demo apples for local testing",
    price: 2.99,
    salePrice: 0,
    category: "Fruits",
    image: "",
    quantity: 50,
    inStock: true,
    isDeleted: false,
    unit: "lb",
    tags: ["demo"],
  },
  {
    name: "Demo Spinach",
    description: "Fresh demo greens",
    price: 3.49,
    salePrice: 2.99,
    category: "Vegetables",
    image: "",
    quantity: 30,
    inStock: true,
    isDeleted: false,
    unit: "bunch",
    tags: ["demo"],
  },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.DB_STRING;
  if (!uri) {
    console.error("Missing DB_STRING (or MONGO_URI) in .env");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const n = await Product.countDocuments();
  if (n > 0) {
    console.log(`Products collection already has ${n} item(s). Skipping seed.`);
    await mongoose.disconnect();
    process.exit(0);
  }
  await Product.insertMany(demos);
  console.log(`Inserted ${demos.length} demo products. Refresh the storefront.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
