const app = require("express")();
const server = require("http").Server(app);
const bodyParser = require("body-parser");
const Datastore = require("nedb");
const bcrypt=require('bcrypt');
const saltRounds =10;

app.use(bodyParser.json());

module.exports = app;


let usersDB = new Datastore({
    filename: process.env.APPDATA + "/POS/server/databases/users.db",
    autoload: true
});


usersDB.ensureIndex({fieldName: '_id', unique: true });

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
        username: req.body.username
    }, 
    function(err, docs) {

        if (docs) {
            //verify password
            bcrypt.compare(req.body.password,docs.password)
            .then(result=>
            {
                if(result)
                {
                    usersDB.update({
                                    _id: docs._id
                                }, {
                                    $set: {
                                        status: 'Logged In_' + new Date()
                                    }
                                }, {},
                
                            );
                 res.send({...docs,'auth':true});
                 
                }
                else
                //Invalid password
                 res.send({'auth':false});
            
            })
            .catch((err)=>res.send({'auth':false,'message':err}));
        }
        else
            //No user Account
            res.send({'auth':false});
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
   
    //encrypt password
    bcrypt.hash(req.body.password,saltRounds)
        .then((hash)=>{
            req.body.password=hash;
           const perms = [
        "perm_products",
        "perm_categories",
        "perm_transactions",
        "perm_users",
        "perm_settings"
    ];

    for (const perm of perms) {
        if (!!req.body[perm]) {
            req.body[perm]=req.body[perm] == "on" ? 1 : 0;
        }
    }
    
    let User = {
        ...req.body,
        "status": ""
    }
    if (req.body.id == "") {
        req.body._id = Math.floor(Date.now() / 1000);
        usersDB.insert(User, function(err, user) {
            if (err) res.status(500).send(err);
        });
    } else {
        usersDB.update({
            _id: parseInt(req.body.id)
        }, {

            $set: User
        }, {}, function(
            err,
            numReplaced,
            user
        ) {
            if (err) res.sendStatus(500).send(err)
            else res.sendStatus(200)
        });

    }

        }).catch(err=>res.sendStatus(500).send(err));
});


app.get("/check", function(req, res) {
    usersDB.findOne({
        _id: 1
    }, function(err, docs) {
        if (!docs) {
            let user = {
                "_id": 1,
                "username": "admin",
                "fullname": "Administrator",
                "perm_products": 1,
                "perm_categories": 1,
                "perm_transactions": 1,
                "perm_users": 1,
                "perm_settings": 1,
                "status": ""
            }

            bcrypt
             .hash("admin", saltRounds)
             .then((err, hash)=> {
              user.password=hash;
              usersDB.insert(user, function(err, user) {
              });
            })
              .catch(err=>res.sendStatus(500).send(err));
                }
    });
});