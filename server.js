let express = require("express"),
    http = require("http"),
    app = require("express")(),
    server = http.createServer(app),
    bodyParser = require("body-parser"),
    RateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 0;

//set up rate limiter: maximum of five requests per minute
var limiter = RateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10
});

// apply rate limiter to all requests
app.use(limiter);

console.log("Server started");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.all("/*", function(req, res, next) {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header(
        "Access-Control-Allow-Headers",
        "Content-type,Accept,X-Access-Token,X-Key"
    );
    if (req.method == "OPTIONS") {
        res.status(200).end();
    } else {
        next();
    }
});

app.get("/", function(req, res) {
    res.send("POS Server Online.");
});

app.use("/api/inventory", require("./api/inventory"));
app.use("/api/customers", require("./api/customers"));
app.use("/api/categories", require("./api/categories"));
app.use("/api/settings", require("./api/settings"));
app.use("/api/users", require("./api/users"));
app.use("/api", require("./api/transactions"));

server.listen(PORT, () => {
    process.env.PORT = server.address().port;
    console.log('Listening on PORT', process.env.PORT);
});