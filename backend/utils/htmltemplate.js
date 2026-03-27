const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

// ✅ Register Capitalize Helper
handlebars.registerHelper("capitalize", function (str) {
  if (typeof str !== "string" || !str.length) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
});

// ✅ Generate Property Listing Email Template
const generateOtpEmail = async (data) => {
  const templatePath = path.join(__dirname, "propertyEmailTemplate.html");
  const source = fs.readFileSync(templatePath, "utf8");
  const template = handlebars.compile(source);
  return template(data);
};

module.exports = {
  generateOtpEmail
};
