const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore =  require('@seald-io/nedb');
const multer = require("multer");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const validator = require("validator");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(
    appData,
    appName,
    "server",
    "databases",
    "settings.db",
);

const storage = multer.diskStorage({
    destination: path.join(appData, appName, "uploads"),
    filename: function (req, file, callback) {
        callback(null, Date.now() + ".jpg"); //
    },
});

let upload = multer({ storage: storage });

app.use(bodyParser.json());

module.exports = app;

let settingsDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

/**
 * GET endpoint: Get the welcome message for the Settings API.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */

app.get("/", function (req, res) {
    res.send("Settings API");
});

/**
 * GET endpoint: Get settings details.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/get", function (req, res) {
    settingsDB.findOne(
        {
            _id: 1,
        },
        function (err, docs) {
            res.send(docs);
        },
    );
});

/**
 * POST endpoint: Create or update settings.
 *
 * @param {Object} req request object with settings data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */

app.post("/post", upload.single("imagename"), function (req, res) {
    let image = "";

    if (validator.escape(req.body.img) != "") {
        image = validator.escape(req.body.img);
    }

    if (req.file) {
        image = validator.escape(req.file.filename);
    }

    if (validator.escape(req.body.remove) == 1) {
        const imgPath = path.join(
            appData,
            appName,
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

    let Settings = {
        _id: 1,
        settings: {
            app: validator.escape(req.body.app),
            store: validator.escape(req.body.store),
            address_one: validator.escape(req.body.address_one),
            address_two: validator.escape(req.body.address_two),
            contact: validator.escape(req.body.contact),
            tax: validator.escape(req.body.tax),
            symbol: validator.escape(req.body.symbol),
            percentage: validator.escape(req.body.percentage),
            charge_tax: validator.escape(req.body.charge_tax),
            footer: validator.escape(req.body.footer),
            img: image,
        },
    };

    if (validator.escape(req.body.id) == "") {
        settingsDB.insert(Settings, function (err, settings) {
            if (err) {
                console.error(err);
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "An unexpected error occurred.",
                });
            } else res.send(settings);
        });
    } else {
        settingsDB.update(
            {
                _id: 1,
            },
            Settings,
            {},
            function (err, numReplaced, settings) {
                if (err) {
                    console.error(err);
                    res.status(500).json({
                        error: "Internal Server Error",
                        message: "An unexpected error occurred.",
                    });
                } else res.sendStatus(200);
            },
        );
    }
});