const OrderCounter = require("../db/models/OrderCounter");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function orderDateParts(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const day = String(d).padStart(2, "0");
  const mon = MONTHS[m] || "JAN";
  const dateKey = `${y}-${String(m + 1).padStart(2, "0")}-${day}`;
  return { day, mon, dateKey };
}

async function generateNextOrderId() {
  const { day, mon, dateKey } = orderDateParts(new Date());
  const counter = await OrderCounter.findOneAndUpdate(
    { dateKey },
    { $inc: { seq: 1 }, $setOnInsert: { dateKey } },
    { upsert: true, new: true }
  ).lean();

  const seq = Number(counter?.seq || 0);
  const serial = String(Math.max(1, seq)).padStart(4, "0");
  return `ZPY-${day}${mon}-${serial}`;
}

module.exports = { generateNextOrderId, orderDateParts };
