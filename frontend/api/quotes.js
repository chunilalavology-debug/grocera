const { forwardToShips } = require("./lib/forwardToShips");

module.exports = async (req, res) => {
  await forwardToShips(req, res, "quotes");
};
