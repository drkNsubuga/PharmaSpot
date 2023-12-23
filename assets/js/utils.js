let fs = require("fs");
const crypto = require("crypto");
let moment = require("moment");
const DATE_FORMAT = "DD-MMM-YYYY";
const PORT = process.env.PORT;
const moneyFormat = (amount, locale = "en-US") => {
  return new Intl.NumberFormat(locale).format(amount);
};

/** Date functions **/

const isExpired = (dueDate) => {
  let todayDate = moment();
  let expiryDate = moment(dueDate, DATE_FORMAT);
  return todayDate.isSameOrAfter(dueDate);
};

const daysToExpire = (dueDate) => {
  let todayDate = moment();
  let expiryDate = moment(dueDate, DATE_FORMAT);

    if (expiryDate.isSameOrBefore(todayDate, 'day')) {
    return 0;
  }

  return expiryDate.diff(todayDate, 'days');
};

/** File **/
const checkImageExists = (imageUrl) => {
  try {
    fs.accessSync(imageUrl, fs.constants.F_OK);
    return true; // Image exists
  } catch (err) {
    return false; // Image does not exist
  }
};

const getFileHash = (filePath) => {
  const fileData = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(fileData).digest("hex");
  return hash;
};

const setContentSecurityPolicy = () => {
  let scriptHash = getFileHash("./assets/dist/js/bundle.min.js");
  let styleHash = getFileHash("./assets/dist/css/bundle.min.css");
  let content = `default-src 'self'; img-src 'self' data:;script-src 'self' 'unsafe-eval' 'unsafe-inline' sha256-${scriptHash}; style-src 'self' 'unsafe-inline' sha256-${styleHash};font-src 'self';base-uri 'self'; form-action 'self'; ;connect-src 'self' http://localhost:${PORT};`;

  let metaTag = document.createElement("meta");
  metaTag.setAttribute("http-equiv", "Content-Security-Policy");
  metaTag.setAttribute("content", content);
  document.head.appendChild(metaTag);
};

module.exports = {
  DATE_FORMAT,
  moneyFormat,
  isExpired,
  daysToExpire,
  checkImageExists,
  setContentSecurityPolicy,
};