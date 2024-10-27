let fs = require("fs");
const crypto = require("crypto");
let moment = require("moment");
const DATE_FORMAT = "DD-MMM-YYYY";
const PORT = process.env.PORT;
let path = require("path");
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

  if (expiryDate.isSameOrBefore(todayDate, "day")) {
    return 0;
  }

  return expiryDate.diff(todayDate, "days");
};

/** Inventory **/
/**
 * Determines the stock status based on current stock and minimum stock levels.
 *
 * @param {number} currentStock - The current quantity of stock.
 * @param {number} minimumStock - The minimum required quantity of stock.
 * @returns {number} - Returns 0 if there is no stock, -1 if the stock is low, and 1 if the stock level is normal.
 */
const getStockStatus = (currentStock, minimumStock)=>{
  currentStock = Number(currentStock);
  minimumStock = Number(minimumStock);

   if (isNaN(currentStock) || isNaN(minimumStock)) {
    throw new Error("Invalid input: both currentStock and minimumStock should be numbers.");
  }

  if (currentStock <= 0) {
    return 0; // No stock
  }

  if (currentStock <= minimumStock) {
    return -1; // Low stock
  }
  return 1; // Normal stock
}


/** File **/
const checkFileExists = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile(); 
  } catch (err) {
    return false;
  }
};

const checkFileType = (fileType, validFileTypes) => {
  return validFileTypes.includes(fileType);
};

const getFileHash = (filePath) => {
  const fileData = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(fileData).digest("hex");
  return hash;
};


const filterFile = (req, file, callback) => {
    try {
      const isValidFile = checkFileType(file.mimetype, validFileTypes);
      if (isValidFile) {
        return callback(null, true);
      } else {
        return callback(new Error(`Invalid file type. Only JPEG, PNG, GIF, and WEBP files are allowed.`), false);
      }
    } catch (err) {
      return callback(new Error(`An error occurred: ${err}`),false);
    }
  }

/*Security*/

const setContentSecurityPolicy = () => {
  let scriptHash = getFileHash(path.join(__dirname,"../dist","js","bundle.min.js"))
  let styleHash = getFileHash(path.join(__dirname,"../dist","css","bundle.min.css"));
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
  getStockStatus,
  getFileHash,
  daysToExpire,
  checkFileExists,
  checkFileType,
  setContentSecurityPolicy
};
