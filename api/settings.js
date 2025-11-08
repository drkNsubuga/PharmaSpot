const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("@seald-io/nedb");
const multer = require("multer");
const sanitizeFilename = require('sanitize-filename');
const fs = require("fs");
const path = require("path");
const validator = require("validator");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const validFileTypes = [
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp"];
const maxFileSize = 2097152 //2MB = 2*1024*1024
const defaultLogoName = "logo";
const {filterFile} = require('../assets/js/utils');
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
        callback(null, defaultLogoName+path.extname(file.originalname));
    },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: maxFileSize },
  fileFilter: filterFile,
}).single("imagename");


app.use(bodyParser.json());

module.exports = app;

let settingsDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

settingsDB.ensureIndex({ fieldName: "_id", unique: true });
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

app.post("/post", function (req, res) {
    upload(req, res, function (err) {

        if (err) {
            if (err instanceof multer.MulterError) {
                console.error('Upload Error:', err);
                return res.status(400).json({
                    error: 'Upload Error',
                    message: err.message,
                });
            } else {
                console.error('Unknown Error:', err);
                return res.status(500).json({
                    error: 'Internal Server Error',
                    message: err.message,
                });
            }
        }

    // Helper function to safely escape values
    const safeEscape = (value) => {
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

    let image = "";

    if (req.body.img && req.body.img !== "") {
        image = sanitizeFilename(req.body.img);
    }

    if (req.file) {
        image = sanitizeFilename(req.file.filename);
    }


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
            }

        }
        
    let Settings = {
        _id: 1,
        settings: {
            app: safeEscape(req.body.app),
            store: safeEscape(req.body.store),
            address_one: safeEscape(req.body.address_one),
            address_two: safeEscape(req.body.address_two),
            contact: safeEscape(req.body.contact),
            tax: safeEscape(req.body.tax),
            symbol: safeEscape(req.body.symbol),
            percentage: safeEscape(req.body.percentage),
            charge_tax: req.body.charge_tax === 'on',
            footer: safeEscape(req.body.footer),
            img: image,
        },
    };

    // Always use update with upsert to avoid duplicate key error
    settingsDB.update(
        { _id: 1 },
        Settings,
        { upsert: true },
        function (err, numReplaced, settings) {
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

});