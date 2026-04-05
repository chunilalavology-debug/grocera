const mongoose = require('mongoose');
const { addTimeStamp } = require('../../utils/addTimeStamp');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  /** Original / compare-at price (MSRP). If greater than `price`, storefront shows a discount. */
  comparePrice: {
    type: Number,
    min: 0,
    default: 0
  },
  salePrice: {
    type: Number,
    min: 0,
    default: 0
  },
  sku: {
    type: String,
    trim: true,
    default: ''
  },
  badge: {
    type: String,
    trim: true,
    default: ''
  },
  isDeal: {
    type: Boolean,
    default: false
  },
  dealPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  category: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: ''
  },
  adminPrice: {
    type: Number,
    min: 0
  },
  inStock: {
    type: Boolean,
    default: true
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  cost: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'piece',
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'product_deals',
  },
  tags: [{
    type: String,
    trim: true
  }],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number
  },
  ...addTimeStamp()
});

productSchema.index({ category: 1 })
productSchema.index({ price: 1 })
productSchema.index({ isDeal: 1, quantity: 1, inStock: 1 })
productSchema.index({ sku: 1 }, { partialFilterExpression: { sku: { $gt: '' } } })
productSchema.index({
  inStock: 1,
  isDeleted: 1,
  category: 1,
  createdAt: -1
});
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: "text" });

productSchema.pre('save', function (next) {
  const qty = this.quantity || 0;
  this.inStock = qty > 0;
  next();
});

module.exports = mongoose.model('Product', productSchema);