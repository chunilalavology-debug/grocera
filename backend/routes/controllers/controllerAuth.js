const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { User } = require("../../db");
const Cart = require("../../db/models/Cart");
const { connectDB } = require("../../lib/db");
const userSellRateLimiter = require("../middlewares/rateLimit");

const formatJoiErrors = (error) => {
  if (!error.details) return '';
  const errors = error.details.map((detail) => {
    return detail.message.replace(/"/g, "");
  });
  return errors.join(', ')
};

const formatDateTime = (value) => {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const idValidation = Joi.object({
  id: Joi.string()
    .length(24)
    .hex()
    .required()
});


const register = async (req, res) => {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(30).required(),
    lastName: Joi.string().min(2).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    referralCode: Joi.string().trim().min(4).max(30).optional().allow(''),
    phone: Joi.string().pattern(/^[0-9+\-() ]{7,20}$/).optional().allow(''),
    address: Joi.object({
      street: Joi.string().max(100).optional().allow(''),
      city: Joi.string().max(50).optional().allow(''),
      state: Joi.string().max(50).optional().allow(''),
      zipCode: Joi.string().max(20).optional().allow(''),
      country: Joi.string().max(50).optional().allow('')
    }).optional(),
    preferences: Joi.object().optional()
  });
  try {
    await schema.validateAsync(req.body, { abortEarly: true });
    const {
      firstName,
      lastName,
      email,
      password,
      referralCode,
      phone,
      address,
      preferences = {}
    } = req.body;

    try {
      await connectDB();
    } catch (dbErr) {
      console.error("register connectDB:", dbErr?.message || dbErr);
      return res.status(503).json({
        success: false,
        message:
          "Database is not reachable. Check MONGO_URI on the server, MongoDB Atlas network access, then try again.",
        code: "DB_NOT_READY",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
        code: 'EMAIL_EXISTS'
      });
    }

    const normalizedReferralCode = (referralCode || '').trim().toUpperCase();
    const referrer = normalizedReferralCode
      ? await User.findOne({ referralCode: normalizedReferralCode, isDeleted: false }).lean()
      : null;

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      address,
      preferences,
      role: 'customer',
      isActive: true,
      isEmailVerified: false,
      lastActivity: new Date(),
      referralDiscountEligible: Boolean(referrer),
      referredBy: referrer ? referrer._id : null
    });

    await user.save();

    const accessToken = user.generateAuthToken();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          preferences: user.preferences,
          isEmailVerified: user.isEmailVerified
        },
        tokens: {
          access: accessToken
        }
      }
    });

  } catch (error) {
    if (error.isJoi) {
      const formattedErrors = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formattedErrors}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.error('Registration error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const loginSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(1).max(128).required(),
      rememberMe: Joi.boolean().optional(),
      guestCartId: Joi.string().trim().max(80).optional().allow("", null),
    });
    const { error: joiErr, value: body } = loginSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (joiErr) {
      return res.status(400).json({
        success: false,
        message: formatJoiErrors(joiErr),
        code: "VALIDATION_ERROR",
      });
    }

    const { email, password, rememberMe = false, guestCartId } = body;

    try {
      await connectDB();
    } catch (dbErr) {
      console.error("login connectDB:", dbErr?.message || dbErr);
      return res.status(503).json({
        success: false,
        message:
          "Database is not reachable. Check MONGO_URI on the server, MongoDB Atlas network access, then try again.",
        code: "DB_NOT_READY",
      });
    }

    const user = await User.findByEmailWithPassword(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked.',
        lockUntil: user.lockUntil
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    await user.resetLoginAttempts();

    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken(
      `${req.get('User-Agent')} - ${req.ip}`
    );

    if (guestCartId) {
      try {
        await Cart.findOrCreateCart(user._id, guestCartId);
      } catch (cartErr) {
        console.error("Login guest cart merge failed (continuing login):", cartErr.message);
      }
    }

    if (rememberMe) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          role: user.role,
          preferences: user.preferences
        },
        tokens: {
          access: accessToken,
          refresh: refreshToken
        }
      }
    });

  } catch (error) {
    console.error("Login error:", error?.message || error, error?.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error during login.",
      code: "LOGIN_SERVER_ERROR",
      detail:
        process.env.NODE_ENV !== "production"
          ? error?.message
          : undefined,
    });
  }
};

const profile = async (req, res) => {
  try {
    const getUser = await User.findById(req.user.id).lean()
    if (!getUser) {
      res.status(401).send({
        success: false,
        message: "User Details Not Found!",
        data: null
      })
    }
    res.json({
      success: true,
      message: "Profile fetch successfully!",
      user: { ...getUser }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

const resetPassword = async (req, res) => {
  const schema = Joi.object({
    password: Joi.string().min(8).max(128).required(),
    token: Joi.string().max(100).required(),
  });
  try {
    await schema.validateAsync(req.body, { abortEarly: true })
    const { token, password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (decoded.type !== "RESET_PASSWORD") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const user = await User.findById(decoded.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.password = password;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });

  } catch (error) {
    if (error.isJoi) {
      const formattedErrors = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formattedErrors}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.log("faild api reset password::: ", error);

    return res.status(401).json({
      success: false,
      message: "Reset link expired or invalid",
    });
  }
};

const changePassword = async (req, res) => {
  const schema = Joi.object({
    newPassword: Joi.string().min(8).max(128).required(),
    currentPassword: Joi.string().required(),
  });
  try {
    await schema.validateAsync(req.body, { abortEarly: true })
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    user.password = newPassword;
    await user.save();
    res.json({
      success: true,
      message: 'Password changed successfully. Please login again on all devices.'
    });

  } catch (error) {
    if (error.isJoi) {
      const formattedErrors = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formattedErrors}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error.'
    });
  }
}

const sendForgetPasswordMail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email })

    if (!user) return res.status(404).json({
      success: false,
      message: "This Email Address account not found! Please Check Email Address or Register First!",
    });

    const resetToken = generateResetToken(user);
    const resetLink = `https://zippyyy.com/reset-password?token=${resetToken}`;

    const html = forgetPwdTemp({
      name: user?.name,
      resetLink,
    });

    await sendMail({
      to: email,
      subject: "Reset Your Zippyyy Account Password",
      html,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset email sent successfully",
    });

  } catch (error) {
    console.error("Mail Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send email",
    });
  }
};

const updateProfile = async (req, res) => {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(30).required(),
    lastName: Joi.string().min(2).max(30).required(),
    phone: Joi.string().pattern(/^[0-9+\-() ]{7,20}$/).optional().allow(''),
    address: Joi.object({
      street: Joi.string().max(100).optional().allow(''),
      city: Joi.string().max(50).optional().allow(''),
      state: Joi.string().max(50).optional().allow(''),
      zipCode: Joi.string().max(20).optional().allow(''),
      country: Joi.string().max(50).optional().allow('')
    }).optional(),
    preferences: Joi.object().optional()
  });
  try {
    await schema.validateAsync(req.body, { abortEarly: true })
    const users = await User.findByIdAndUpdate(req.user.id, req.body)
    if (!users) {
      res.status(404).send({
        success: false,
        message: "Users Not found!",
        data: null
      })
    }
    res.status(200).send({
      success: true, message: "User update Succesfully"
    })
  } catch (error) {
    if (error.isJoi) {
      const formattedErrors = formatJoiErrors(error);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${formattedErrors}`,
        code: 'VALIDATION_ERROR'
      });
    }
    console.error("updateProfile Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error.'
    });
  }
};

router.post('/register', register);
router.post('/login', login);
router.get('/profile', profile);
router.post('/forgetPasswordSendMail', userSellRateLimiter, sendForgetPasswordMail)
router.post('/resetpassword', userSellRateLimiter, resetPassword)
router.post('/changePassword', changePassword);
router.put('/updateProfile', updateProfile);

module.exports = router;
