const http = require("http");
const express = require("express")();
const server = http.createServer(express);
const bodyParser = require("body-parser");
// const rateLimit = require("express-rate-limit"); // Disabled for development
const pkg = require("./package.json");
const {app} = require('electron');
process.env.APPDATA = app.getPath('appData');
process.env.APPNAME = pkg.name;
const PORT = process.env.PORT || 0;
// Rate limiter disabled for development - can be re-enabled for production
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // 100 requests per window
// });

console.log("Server started");

express.use(bodyParser.json());
express.use(bodyParser.urlencoded({ extended: false }));
// express.use(limiter); // Disabled for development

express.all("/*", function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header(
        "Access-Control-Allow-Headers",
        "Content-type,Accept,X-Access-Token,X-Key",
    );
    if (req.method == "OPTIONS") {
        res.status(200).end();
    } else {
        next();
    }
});

express.get("/", function (req, res) {
    res.send("POS Server Online.");
});

express.use("/api/inventory", require("./api/inventory"));
express.use("/api/customers", require("./api/customers"));
express.use("/api/categories", require("./api/categories"));
express.use("/api/settings", require("./api/settings"));
express.use("/api/users", require("./api/users"));
express.use("/api", require("./api/transactions"));

server.listen(PORT, () => {
    process.env.PORT = server.address().port;
    console.log("Listening on PORT", process.env.PORT);
});

/**
 * Restarts the server process.
 */
function restartServer() {
    server.close(() => {
        // Remove cached modules so require() reloads them
        Object.keys(require.cache).forEach(key => {
            if (key.includes('api') || key.endsWith('server.js')) {
                delete require.cache[key];
            }
        });
        // Re-require server.js to restart everything
        require('./server');
    });
}

module.exports = { restartServer };