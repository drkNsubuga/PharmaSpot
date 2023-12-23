const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("@seald-io/nedb");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const validator = require("validator");
const path = require("path");
const dbPath = path.join(
    process.env.APPDATA,
    process.env.APPNAME,
    "server",
    "databases",
    "users.db",
);

app.use(bodyParser.json());

module.exports = app;

let usersDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

usersDB.ensureIndex({ fieldName: "username", unique: true });

/**
 * GET endpoint: Get the welcome message for the Users API.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/", function (req, res) {
    res.send("Users API");
});

/**
 * GET endpoint: Get user details by user ID.
 *
 * @param {Object} req request object with user ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/user/:userId", function (req, res) {
    if (!req.params.userId) {
        res.status(500).send("ID field is required.");
    } else {
        usersDB.findOne(
            {
                _id: parseInt(req.params.userId),
            },
            function (err, docs) {
                res.send(docs);
            },
        );
    }
});

/**
 * GET endpoint: Log out a user by updating the user status.
 *
 * @param {Object} req request object with user ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/logout/:userId", function (req, res) {
    if (!req.params.userId) {
        res.status(500).send("ID field is required.");
    } else {
        usersDB.update(
            {
                _id: parseInt(req.params.userId),
            },
            {
                $set: {
                    status: "Logged Out_" + new Date(),
                },
            },
            {},
        );

        res.sendStatus(200);
    }
});

/**
 * POST endpoint: Authenticate user login and update user status.
 *
 * @param {Object} req request object with login credentials in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/login", function (req, res) {
    usersDB.findOne(
        {
            username: validator.escape(req.body.username),
        },
        function (err, docs) {
            if (docs) {
                //verify password
                bcrypt
                    .compare(validator.escape(req.body.password), docs.password)
                    .then((result) => {
                        if (result) {
                            usersDB.update(
                                {
                                    _id: docs._id,
                                },
                                {
                                    $set: {
                                        status: "Logged In_" + new Date(),
                                    },
                                },
                                {},
                            );
                            res.send({ ...docs, auth: true });
                        }
                        //Invalid password
                        else res.send({ auth: false });
                    })
                    .catch((err) =>
                        res.send({ auth: false, message: err.message }),
                    );
            }
            //No user Account
            else res.send({ auth: false });
        },
    );
});

/**
 * GET endpoint: Get details of all users.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/all", function (req, res) {
    usersDB.find({}, function (err, docs) {
        res.send(docs);
    });
});

/**
 * DELETE endpoint: Delete a user by user ID.
 *
 * @param {Object} req request object with user ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.delete("/user/:userId", function (req, res) {
    usersDB.remove(
        {
            _id: parseInt(req.params.userId),
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
 * POST endpoint: Create or update a user.
 *
 * @param {Object} req request object with user data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/post", function (req, res) {
    //encrypt password
    bcrypt
        .hash(req.body.password, saltRounds)
        .then((hash) => {
            req.body.password = hash;
            const perms = [
                "perm_products",
                "perm_categories",
                "perm_transactions",
                "perm_users",
                "perm_settings",
            ];

            for (const perm of perms) {
                if (!!req.body[perm]) {
                    req.body[perm] = req.body[perm] == "on" ? 1 : 0;
                } else {
                    req.body[perm] = 0;
                }
            }

            let User = {
                ...req.body,
                status: "",
            };
            delete User.id;
            if (req.body.id == "") {
                req.body._id = Math.floor(Date.now() / 1000);
                usersDB.insert(User, function (err, user) {
                    if (err) {
                        console.error(err);
                        res.status(500).json({
                            error: "Internal Server Error",
                            message: "An unexpected error occurred.",
                        });
                    }
                });
            } else {
                usersDB.update(
                    {
                        _id: parseInt(req.body.id),
                    },
                    {
                        $set: User,
                    },
                    {},
                    function (err, numReplaced, user) {
                        if (err) res.sendStatus(500).send(err);
                        else {
                            res.sendStatus(200);
                        }
                    },
                );
            }
        })
        .catch((err) => res.sendStatus(500).send(err.message));
});

/**
 * GET endpoint: Check and initialize the default admin user if not exists.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/check", function (req, res) {
    usersDB.findOne(
        {
            _id: 1,
        },
        function (err, docs) {
            if (!docs) {
                bcrypt
                    .hash("admin", saltRounds)
                    .then((hash) => {
                        let user = {
                            _id: 1,
                            username: "admin",
                            fullname: "Administrator",
                            perm_products: 1,
                            perm_categories: 1,
                            perm_transactions: 1,
                            perm_users: 1,
                            perm_settings: 1,
                            status: "",
                        };
                        user.password = hash;
                        usersDB.insert(user, function (err, user) {
                            if (err) {
                                console.error(err);
                                res.status(500).json({
                                    error: "Internal Server Error",
                                    message: "An unexpected error occurred.",
                                });
                            }
                        });
                    })
                    .catch((err) => res.sendStatus(500).send(err.message));
            }
        },
    );
});
