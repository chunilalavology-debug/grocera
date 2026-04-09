const mongoose = require("mongoose");
const Order = require("../db/models/Order");
const Voucher = require("../db/models/voucher");

/**
 * Increment voucher.usedCount once per order when payment succeeds (Stripe webhook or OTC).
 * Skips referral-style rows where coupon.couponId is null.
 */
async function recordVoucherRedemptionOnce(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return;
  const oid = new mongoose.Types.ObjectId(orderId);

  const order = await Order.findOneAndUpdate(
    {
      _id: oid,
      voucherRedemptionRecorded: { $ne: true },
      "coupon.couponId": { $exists: true, $ne: null },
    },
    { $set: { voucherRedemptionRecorded: true } },
    { new: true }
  )
    .select("coupon")
    .lean();

  if (!order?.coupon?.couponId) return;

  await Voucher.updateOne({ _id: order.coupon.couponId }, { $inc: { usedCount: 1 } });
}

module.exports = { recordVoucherRedemptionOnce };
