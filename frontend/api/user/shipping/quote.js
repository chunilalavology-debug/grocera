const { forwardToGroceryUser } = require("../../lib/forwardToGroceryUser");

module.exports = async (req, res) => forwardToGroceryUser(req, res, "shipping/quote");
