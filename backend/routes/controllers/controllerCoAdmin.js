const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { Products } = require("../../db");
const { PRODUCT_NOT_DELETED } = require("../../utils/categoryCounts");
const { connectDB } = require("../../lib/db");
const { authorize } = require("../middlewares/rbacMiddleware");
const Order = require("../../db/models/Order");
const coAdminAuth = [authorize(['co-admin'])];

const formatJoiErrors = (error) => {
  if (!error.details) return '';
  const errors = error.details.map((detail) => {
    return detail.message.replace(/"/g, "");
  });
  return errors.join(', ')
};

const idValidation = Joi.object({
  id: Joi.string()
    .length(24)
    .hex()
    .required()
});

const getOrderList = async (req, res) => {
  try {
    const { status = 'pending', limit = 50, page = 1 } = req.query;

    const query = { status: { $in: ['pending', 'confirmed'] } };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate({
        path: 'user',
        select: 'name email',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'userId',
        select: 'name email',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'items.product',
        select: 'name price',
        options: { strictPopulate: false }
      })
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const enrichedOrders = orders.map(order => ({
      ...order,
      customerName: order.user?.name || order.userId?.name ||
        `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim() ||
        'Guest Customer',
      customerEmail: order.user?.email || order.userId?.email ||
        order.shippingAddress?.email ||
        'No email provided'
    }));

    const totalOrders = await Order.countDocuments(query);

    res.json({
      success: true,
      orders: enrichedOrders,
      totalOrders,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalOrders / parseInt(limit))
    });
  } catch (error) {
    console.error('Co-admin orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving orders'
    });
  }
};

const orderCount = async (req, res) => {
  try {
    const newOrdersCount = await Order.countDocuments({
      status: { $in: ['pending', 'confirmed'] },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    res.json({
      success: true,
      count: newOrdersCount
    });
  } catch (error) {
    console.error('Co-admin order count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving order count'
    });
  }
};

const getAdminProducts = async (req, res) => {
  const validation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).allow(null, ""),
    category: Joi.string().max(50).allow(null, "")
  }).unknown(true);
  try {
    await connectDB();
    await validation.validateAsync(req.query, { abortEarly: true });
    let { page = 1, limit = 20 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    let query = {
      ...PRODUCT_NOT_DELETED,
    };

    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: "i" };
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    const [products, total, inStockCount, outOfStockCount] = await Promise.all([
      Products.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Products.countDocuments(query),
      Products.countDocuments({ ...query, inStock: true }),
      Products.countDocuments({ ...query, inStock: false }),
    ]);
    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
      stats: {
        inStock: inStockCount,
        outOfStock: outOfStockCount,
      }
    });

  } catch (error) {
    const mapError = formatJoiErrors(error);
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('getAdminProducts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products',
      error: error.message
    });
  }
};

const createProduct = async (req, res) => {
  const createProductSchema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    description: Joi.string().trim().required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().trim().required(),
    image: Joi.string().allow("").optional(),
    adminPrice: Joi.number().min(0).optional(),
    cost: Joi.number().min(0).optional().default(0),
    quantity: Joi.number().min(0).optional().default(0),
    inStock: Joi.boolean().optional(),
    unit: Joi.string().trim().optional().default("piece"),
    discount: Joi.number().min(0).max(100).optional().default(0),
    dealId: Joi.string().hex().length(24).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    nutritionInfo: Joi.object({
      calories: Joi.number().optional(),
      protein: Joi.number().optional(),
      carbs: Joi.number().optional(),
      fat: Joi.number().optional(),
      fiber: Joi.number().optional(),
    }).optional(),
  });
  try {
    await createProductSchema.validateAsync(req.body, { abortEarly: true });
    const productData = req.body;

    productData.price = Number(productData.price);
    productData.cost = Number(productData.cost || 0);


    const quantity =
      Number(productData.quantity ??
        productData.stockQuantity ??
        0);

    productData.quantity = quantity;
    productData.stockQuantity = quantity;
    productData.inStock = quantity > 0;

    productData.discount = Number(productData.discount || 0);
    productData.image = productData.image || "";
    productData.unit = productData.unit || "piece";
    productData.tags = Array.isArray(productData.tags)
      ? productData.tags
      : [];

    const product = new Products(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Create product error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

const updateProduct = async (req, res) => {
  const updateProductSchema = Joi.object({
    name: Joi.string().trim().min(2).optional(),
    description: Joi.string().trim().optional(),
    price: Joi.number().min(0).optional(),
    category: Joi.string().trim().optional(),
    image: Joi.string().allow("").optional(),
    adminPrice: Joi.number().min(0).optional(),
    cost: Joi.number().min(0).optional(),
    quantity: Joi.number().min(0).optional(),
    inStock: Joi.boolean().optional(),
    unit: Joi.string().trim().optional(),
    discount: Joi.number().min(0).max(100).optional(),
    dealId: Joi.string().hex().length(24).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    nutritionInfo: Joi.object({
      calories: Joi.number().optional(),
      protein: Joi.number().optional(),
      carbs: Joi.number().optional(),
      fat: Joi.number().optional(),
      fiber: Joi.number().optional(),
    }).optional(),
  });
  try {
    await updateProductSchema.validateAsync(req.body, { abortEarly: true });
    const { id } = req.params;
    const updates = req.body;

    const product = await Products.findByIdAndUpdate(
      { _id: id, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product
      }
    });

  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
}

const deleteProduct = async (req, res) => {
  try {
    idValidation.validateAsync(req.params, { abortEarly: true });
    const { id } = req.params;

    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isDeleted = true;
    await product.save();

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id: product._id,
        name: product.name
      }
    });

  } catch (error) {
    if (error.isJoi) {
      const mapError = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${mapError}`
      });
    }
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
}

router.get('/products', coAdminAuth, getAdminProducts)
router.post('/products', coAdminAuth, createProduct)
router.put('/products/:id', coAdminAuth, updateProduct)
router.delete('/products/:id', coAdminAuth, deleteProduct)
router.get('/orders/count', coAdminAuth, orderCount)
router.get('/orders', coAdminAuth, getOrderList)

module.exports = router;