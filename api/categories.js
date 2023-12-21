const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("nedb");
const async = require("async");
const path = require("path");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(
    appData,
    appName,
    "server",
    "databases",
    "categories.db",
);

app.use(bodyParser.json());

module.exports = app;

let categoryDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

categoryDB.ensureIndex({ fieldName: "_id", unique: true });

/**
 * GET endpoint: Get the welcome message for the Category API.
 *
 * @param {Object} req  request object.
 * @param {Object} res  response object.
 * @returns {void}
 */
app.get("/", function (req, res) {
    res.send("Category API");
});

/**
 * GET endpoint: Get details of all categories.
 *
 * @param {Object} req  request object.
 * @param {Object} res  response object.
 * @returns {void}
 */
app.get("/all", function (req, res) {
    categoryDB.find({}, function (err, docs) {
        res.send(docs);
    });
});

/**
 * POST endpoint: Create a new category.
 *
 * @param {Object} req  request object with new category data in the body.
 * @param {Object} res  response object.
 * @returns {void}
 */
app.post("/category", function (req, res) {
    let newCategory = req.body;
    newCategory._id = Math.floor(Date.now() / 1000);
    categoryDB.insert(newCategory, function (err, category) {
        if (err) res.status(500).send(err);
        else res.sendStatus(200);
    });
});

/**
 * DELETE endpoint: Delete a category by category ID.
 *
 * @param {Object} req  request object with category ID as a parameter.
 * @param {Object} res  response object.
 * @returns {void}
 */
app.delete("/category/:categoryId", function (req, res) {
    categoryDB.remove(
        {
            _id: parseInt(req.params.categoryId),
        },
        function (err, numRemoved) {
            if (err) res.status(500).send(err);
            else res.sendStatus(200);
        },
    );
});

/**
 * PUT endpoint: Update category details.
 *
 * @param {Object} req  request object with updated category data in the body.
 * @param {Object} res  response object.
 * @returns {void}
 */
app.put("/category", function (req, res) {
    categoryDB.update(
        {
            _id: parseInt(req.body.id),
        },
        req.body,
        {},
        function (err, numReplaced, category) {
            if (err) res.status(500).send(err);
            else res.sendStatus(200);
        },
    );
});