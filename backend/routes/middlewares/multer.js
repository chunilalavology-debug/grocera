const multer = require("multer");
const path = require("path");
const fs = require("fs");

function uploadDestination() {
  const dest = process.env.VERCEL
    ? "/tmp/upload"
    : path.join(__dirname, "../../upload");
  try {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  } catch (_) {
    /* ignore */
  }
  return dest;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDestination());
  },

  filename: function (req, file, cb) {
    cb(null, file.originalname + "-" + Date.now());
  },
});


module.exports = multer({ 
    storage, 
})
