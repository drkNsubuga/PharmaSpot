const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("nedb");
const btoa = require('btoa');
app.use(bodyParser.json());

module.exports = app;


let usersDB = new Datastore({
    filename: process.env.APPDATA + "/POS/server/databases/users.db",
    autoload: true
});


usersDB.ensureIndex({ fieldName: '_id', unique: true });


app.get("/", function(req, res) {
    res.send("Users API");
});



app.get("/user/:userId", function(req, res) {
    if (!req.params.userId) {
        res.status(500).send("ID field is required.");
    } else {
        usersDB.findOne({
            _id: parseInt(req.params.userId)
        }, function(err, docs) {
            res.send(docs);
        });
    }
});



app.get("/logout/:userId", function(req, res) {
    if (!req.params.userId) {
        res.status(500).send("ID field is required.");
    } else {
        usersDB.update({
            _id: parseInt(req.params.userId)
        }, {
            $set: {
                status: 'Logged Out_' + new Date()
            }
        }, {}, );

        res.sendStatus(200);

    }
});



app.post("/login", function(req, res) {
    usersDB.findOne({
        username: req.body.username,
        password: btoa(req.body.password)

    }, function(err, docs) {
        if (docs) {
            usersDB.update({
                    _id: docs._id
                }, {
                    $set: {
                        status: 'Logged In_' + new Date()
                    }
                }, {},

            );
        }
        res.send(docs);
    });

});



app.get("/all", function(req, res) {
    usersDB.find({}, function(err, docs) {
        res.send(docs);
    });
});


app.delete("/user/:userId", function(req, res) {
    usersDB.remove({
        _id: parseInt(req.params.userId)
    }, function(err, numRemoved) {
        if (err) res.status(500).send(err);
        else res.sendStatus(200);
    });
});


app.post("/post", function(req, res) {
    //rename id in request
    req.body["_id"] = req.body["id"];
    delete obj['id'];

    const perms = [
        "perm_products",
        "perm_categories",
        "perm_transactions",
        "perm_users",
        "perm_settings"
    ];

    for (const perm of perms) {
        if (req.body[perm] != 'undefined') {
            req.body[perm] == "on" ? 1 : 0;
        }
    }
    let User = {
        ...req.body,
        "password": btoa(req.body.password),
        "status": ""
    }
    res.send("console");
    if (req.body._id == "") {
        req.body._id = Math.floor(Date.now() / 1000);
        usersDB.insert(User, function(err, user) {
            if (err) res.status(500).send(req);
            else res.sendStatus(200);
        });
    } else {
        usersDB.update({
            _id: parseInt(req.body._id)
        }, {

            $set: {
                ...req.body,
                password: btoa(req.body.password)
            }
        }, {}, function(
            err,
            numReplaced,
            user
        ) {
            if (err) res.status(500).send(err);
            else res.sendStatus(200);
        });

    }

});


app.get("/check", function(req, res) {
    usersDB.findOne({
        _id: 1
    }, function(err, docs) {
        if (!docs) {
            let User = {
                "_id": 1,
                "username": "admin",
                "password": btoa("admin"),
                "fullname": "Administrator",
                "perm_products": 1,
                "perm_categories": 1,
                "perm_transactions": 1,
                "perm_users": 1,
                "perm_settings": 1,
                "status": ""
            }
            usersDB.insert(User, function(err, user) {});
        }
    });
});