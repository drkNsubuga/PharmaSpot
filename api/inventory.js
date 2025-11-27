const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("@seald-io/nedb");
const async = require("async");
const sanitizeFilename = require('sanitize-filename');
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {filterFile} = require('../assets/js/utils');
const validFileTypes = [
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp"];
const maxFileSize = 2097152 //2MB = 2*1024*1024
const validator = require("validator");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(
    appData,
    appName,
    "server",
    "databases",
    "inventory.db",
);

const storage = multer.diskStorage({
    destination: path.join(appData, appName, "uploads"),
    filename: function (req, file, callback) {
        callback(null, Date.now()+path.extname(file.originalname));
    },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: maxFileSize },
  fileFilter: filterFile,
}).single("imagename");

// Middleware wrapper to make file upload optional
const optionalUpload = (req, res, next) => {
    upload(req, res, (err) => {
        // Ignore errors if no file was provided
        if (err instanceof multer.MulterError && err.code === 'UNEXPECTED_FIELD') {
            return next();
        }
        if (err) {
            return next(err);
        }
        next();
    });
};


app.use(bodyParser.json());

module.exports = app;

let inventoryDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

inventoryDB.ensureIndex({ fieldName: "_id", unique: true });

/**
 * GET endpoint: Get the welcome message for the Inventory API.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/", function (req, res) {
    res.send("Inventory API");
});

/**
 * GET endpoint: Get product details by product ID.
 *
 * @param {Object} req request object with product ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/product/:productId", function (req, res) {
    if (!req.params.productId) {
        res.status(500).send("ID field is required.");
    } else {
        inventoryDB.findOne(
            {
                _id: parseInt(req.params.productId),
            },
            function (err, product) {
                res.send(product);
            },
        );
    }
});

/**
 * GET endpoint: Get details of all products.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/products", function (req, res) {
    inventoryDB.find({}, function (err, docs) {
        res.send(docs);
    });
});

/**
 * GET endpoint: Search products by name or barcode.
 *
 * @param {Object} req request object with search query.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/search", function (req, res) {
    const searchTerm = req.query.q || '';
    if (!searchTerm) {
        return res.send([]);
    }
    
    const searchRegex = new RegExp(searchTerm, 'i');
    inventoryDB.find({
        $or: [
            { name: searchRegex },
            { barcode: searchRegex }
        ]
    }, function (err, docs) {
        if (err) {
            res.status(500).json({
                error: "Search Error",
                message: "Failed to search products.",
            });
        } else {
            res.send(docs);
        }
    });
});

/**
 * POST endpoint: Update stock for a product.
 *
 * @param {Object} req request object with product ID and new stock.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/update-stock", function (req, res) {
    const productId = parseInt(req.body.product_id || 0);
    const newStock = parseInt(req.body.new_stock || 0);
    
    if (!productId || isNaN(newStock)) {
        return res.status(400).json({
            error: "Invalid Request",
            message: "Product ID and new stock are required.",
        });
    }
    
    inventoryDB.update(
        { _id: productId },
        { 
            $set: { 
                total_stock_base_units: newStock,
                quantity: newStock
            }
        },
        {},
        function (err, numReplaced) {
            if (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "Failed to update stock.",
                });
            } else {
                res.sendStatus(200);
            }
        }
    );
});

/**
 * POST endpoint: Create or update a product.
 *
 * @param {Object} req request object with product data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/product", optionalUpload, function (req, res) {
    // Multer errors are already handled by optionalUpload middleware
    
    let image = "";

    if (req.body.img && req.body.img !== "") {
        image = sanitizeFilename(req.body.img);
    }

    if (req.file) {
        image = sanitizeFilename(req.file.filename);
    }

    // Helper function to safely escape values - define early
    const safeEscape = (value) => {
        // Handle all falsy and non-string values
        if (value === undefined || value === null || value === '') return '';
        if (typeof value === 'object') return '';
        
        try {
            const strValue = String(value);
            if (!strValue || strValue === 'undefined' || strValue === 'null') return '';
            return validator.escape(strValue);
        } catch (e) {
            return '';
        }
    };

    // Helper function for safe number parsing
    const safeParseFloat = (value, defaultVal = 0) => {
        if (value === undefined || value === null || value === '') return defaultVal;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultVal : parsed;
    };

    const safeParseInt = (value, defaultVal = 0) => {
        if (value === undefined || value === null || value === '') return defaultVal;
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultVal : parsed;
    };

    if (safeEscape(req.body.remove) === "1") {
            try {
                let imgPath = path.join(
                appData,
                appName,
                "uploads",
                image,
                );

                if (!req.file) {
                fs.unlinkSync(imgPath);
                image = "";
                }
                
            } catch (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "An unexpected error occurred.",
                });
            }

        }

    // Enhanced UoM Product Schema
    let Product = {
        _id: req.body.id ? parseInt(req.body.id) : Date.now() + Math.floor(Math.random() * 1000),
        barcode: safeEscape(req.body.barcode) || '',
        expirationDate: safeEscape(req.body.expirationDate) || '',
        
        // Legacy fields for backward compatibility
        price: safeParseFloat(req.body.price || req.body.selling_price, 0).toString(),
        category: safeEscape(req.body.category) || safeEscape(req.body.category_id) || '',
        quantity: safeParseInt(req.body.quantity, 0),
        
        // UoM fields
        base_unit_name: safeEscape(req.body.base_unit_name) || 'Unit',
        cost_price: safeParseFloat(req.body.cost_price, 0),
        selling_price: safeParseFloat(req.body.selling_price || req.body.price, 0),
        wholesale_price: safeParseFloat(req.body.wholesale_price || req.body.selling_price, 0),
        
        // Stock tracking in base units
        total_stock_base_units: safeParseInt(req.body.total_stock_base_units || req.body.quantity, 0),
        min_stock_base_units: safeParseInt(req.body.min_stock_base_units || req.body.minStock, 0),
        
        // Packages (JSON string)
        packages: req.body.packages || '[]',
        
        name: safeEscape(req.body.name),
        stock: req.body.stock === "on" || req.body.stock === 0 ? 0 : 1,
        minStock: safeParseInt(req.body.minStock || req.body.min_stock_base_units, 0).toString(),
        category_id: safeEscape(req.body.category_id) || safeEscape(req.body.category) || '',
        img: image,
    };

    if (!req.body.id || req.body.id === "") {
        // Create new product with unique ID
        Product._id = Date.now() + Math.floor(Math.random() * 1000);
        inventoryDB.insert(Product, function (err, product) {
            if (err) {
                console.error('Product creation error:', err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: err.message || "An unexpected error occurred.",
                });
            } else {
                res.sendStatus(200);
            }
        });
    } else {
        inventoryDB.update(
            {
                _id: parseInt(req.body.id || 0),
            },
            Product,
            {},
            function (err, numReplaced, product) {
                if (err) {
                    console.error(err);
                    res.status(500).json({
                        error: "Internal Server Error",
                        message: "An unexpected error occurred.",
                    });
                } else {
                    res.sendStatus(200);
                }
            },
        );
    }
});

/**
 * DELETE endpoint: Delete a product by product ID.
 *
 * @param {Object} req request object with product ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.delete("/product/:productId", function (req, res) {
    inventoryDB.remove(
        {
            _id: parseInt(req.params.productId),
        },
        function (err, numRemoved) {
            if (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "An unexpected error occurred.",
                });
            } else {
                res.sendStatus(200);
            }
        },
    );
});

/**
 * POST endpoint: Find a product by SKU code.
 *
 * @param {Object} req request object with SKU code in the body.
 * @param {Object} res response object.
 * @returns {void}
 */

app.post("/product/sku", function (req, res) {
    let sku = req.body.skuCode || '';
    inventoryDB.findOne(
        {
            barcode: parseInt(sku),
        },
        function (err, doc) {
            if (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "An unexpected error occurred.",
                });
            } else {
                res.send(doc);
            }
        },
    );
});

/**
 * Decrement inventory quantities based on a list of products in a transaction.
 * Handles both base units and packages.
 *
 * @param {Array} products - List of products in the transaction.
 * @returns {void}
 */
app.decrementInventory = function (products) {
    async.eachSeries(products, function (transactionProduct, callback) {
        inventoryDB.findOne(
            {
                _id: parseInt(transactionProduct.id),
            },
            function (err, product) {
                if (!product || !product.quantity) {
                    callback();
                } else {
                    // Calculate base units to deduct
                    const packageUnits = transactionProduct.package_units || 1;
                    const quantitySold = parseInt(transactionProduct.quantity);
                    const baseUnitsToDeduct = quantitySold * packageUnits;
                    
                    // Update both total_stock_base_units and quantity (legacy)
                    const currentStock = parseInt(product.total_stock_base_units || product.quantity);
                    const updatedQuantity = Math.max(0, currentStock - baseUnitsToDeduct);

                    inventoryDB.update(
                        {
                            _id: parseInt(product._id),
                        },
                        {
                            $set: {
                                quantity: updatedQuantity,
                                total_stock_base_units: updatedQuantity
                            },
                        },
                        {},
                        callback,
                    );
                }
            },
        );
    });
};
