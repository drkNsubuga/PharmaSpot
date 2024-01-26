const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("@seald-io/nedb");
const async = require("async");
// const fileUpload = require("express-fileupload");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const allowedExtensions = [".jpg", ".jpeg", ".png"];
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
    destination: path.join(appData, process.env.APPNAME, "uploads"),
    filename: function (req, file, callback) {
        callback(null, Date.now() + ".jpg");
    },
});

let upload = multer({ storage: storage });

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
 * POST endpoint: Create or update a product.
 *
 * @param {Object} req request object with product data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/product", upload.single("imagename"), function (req, res) {
    let image = "";

    if (req.body.img != "") {
        image = validator.escape(req.body.img);
    }

    if (req.file) {
        image = req.file.filename;
    }

    if (validator.escape(req.body.remove) == 1) {
        const imgName = path.basename(req.body.img);
        const isValidimage =
            allowedExtensions.includes(path.extname(imgName).toLowerCase()) &&
            validator.isAlphanumeric(imgName);

        if (isValidimage) {
            const imgPath = path.join(
                appData,
                process.env.APPNAME,
                "uploads",
                validator.escape(req.body.img),
            );
            try {
                fs.unlinkSync(imgPath);
            } catch (err) {
                console.error(err);
            }

            if (!req.file) {
                image = "";
            }
        }
    }

    let Product = {
        _id: parseInt(validator.escape(req.body.id)),
        barcode: parseInt(validator.escape(req.body.barcode)),
        expirationDate: validator.escape(req.body.expirationDate),
        price: validator.escape(req.body.price),
        category: validator.escape(req.body.category),
        quantity:
            validator.escape(req.body.quantity) == ""
                ? 0
                : validator.escape(req.body.quantity),
        name: validator.escape(req.body.name),
        stock: req.body.stock == "on" ? 0 : 1,
        minStock: validator.escape(req.body.minStock),
        img: image,
    };

    if (validator.escape(req.body.id) == "") {
        Product._id = Math.floor(Date.now() / 1000);
        inventoryDB.insert(Product, function (err, product) {
            if (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "An unexpected error occurred.",
                });
            } else {
                res.send(product);
            }
        });
    } else {
        inventoryDB.update(
            {
                _id: parseInt(validator.escape(req.body.id)),
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
    let sku = validator.escape(req.body.skuCode);
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
                    let updatedQuantity =
                        parseInt(product.quantity) -
                        parseInt(transactionProduct.quantity);

                    inventoryDB.update(
                        {
                            _id: parseInt(product._id),
                        },
                        {
                            $set: {
                                quantity: updatedQuantity,
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
