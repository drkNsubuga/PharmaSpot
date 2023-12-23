let app = require("express")();
let server = require("http").Server(app);
let bodyParser = require("body-parser");
let Datastore = require("@seald-io/nedb");
let Inventory = require("./inventory");
const path = require("path");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(
  appData,
  appName,
  "server",
  "databases",
  "transactions.db",
);

app.use(bodyParser.json());

module.exports = app;

let transactionsDB = new Datastore({
  filename: dbPath,
  autoload: true,
});

transactionsDB.ensureIndex({ fieldName: "_id", unique: true });

/**
 * GET endpoint: Get the welcome message for the Transactions API.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/", function (req, res) {
  res.send("Transactions API");
});

/**
 * GET endpoint: Get details of all transactions.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/all", function (req, res) {
  transactionsDB.find({}, function (err, docs) {
    res.send(docs);
  });
});

/**
 * GET endpoint: Get on-hold transactions.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/on-hold", function (req, res) {
  transactionsDB.find(
    { $and: [{ ref_number: { $ne: "" } }, { status: 0 }] },
    function (err, docs) {
      if (docs) res.send(docs);
    },
  );
});

/**
 * GET endpoint: Get customer orders with a status of 0 and an empty reference number.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/customer-orders", function (req, res) {
  transactionsDB.find(
    { $and: [{ customer: { $ne: "0" } }, { status: 0 }, { ref_number: "" }] },
    function (err, docs) {
      if (docs) res.send(docs);
    },
  );
});

/**
 * GET endpoint: Get transactions based on date, user, and till parameters.
 *
 * @param {Object} req request object with query parameters.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/by-date", function (req, res) {
  let startDate = new Date(req.query.start);
  let endDate = new Date(req.query.end);

  if (req.query.user == 0 && req.query.till == 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user != 0 && req.query.till == 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { user_id: parseInt(req.query.user) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user == 0 && req.query.till != 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { till: parseInt(req.query.till) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user != 0 && req.query.till != 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { till: parseInt(req.query.till) },
          { user_id: parseInt(req.query.user) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }
});

/**
 * POST endpoint: Create a new transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/new", function (req, res) {
  let newTransaction = req.body;

  transactionsDB.insert(newTransaction, function (err, transaction) {
    if (err) {
      console.error(err);
      res.status(500).json({
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      });
    } else {
      res.sendStatus(200);

      if (newTransaction.paid >= newTransaction.total) {
        Inventory.decrementInventory(newTransaction.items);
      }
    }
  });
});

/**
 * PUT endpoint: Update an existing transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.put("/new", function (req, res) {
  let oderId = req.body._id;
  transactionsDB.update(
    {
      _id: oderId,
    },
    req.body,
    {},
    function (err, numReplaced, order) {
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
 * POST endpoint: Delete a transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/delete", function (req, res) {
  let transaction = req.body;
  transactionsDB.remove(
    {
      _id: transaction.orderId,
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
 * GET endpoint: Get details of a specific transaction by transaction ID.
 *
 * @param {Object} req request object with transaction ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/:transactionId", function (req, res) {
  transactionsDB.find({ _id: req.params.transactionId }, function (err, doc) {
    if (doc) res.send(doc[0]);
  });
});
