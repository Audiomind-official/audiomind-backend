const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
var cors = require("cors");

// DATABASE INIT
const { DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME, DB_DEBUG } = process.env;
const DB_URL = `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/?retryWrites=true&w=majority`;

console.log(DB_URL);

mongoose.connect(DB_URL, {
  useNewUrlParser: true,
});

mongoose.set("debug", DB_DEBUG);
let db = mongoose.connection;

db.once("open", () => console.log("Connected to MongoDB"));
db.on("error", (err) => console.log(err));

// APP INIT
const app = express();
app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: 1024 * 1024 * 10,
  })
);
app.use(bodyParser.json());

// SESSION MIDDLEWARE
app.use(
  session({
    secret: "5EBxYUcKZgLcrJgZAapTHkjL",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, maxAge: 60000 },
  })
);

// ROUTES
app.use(express.static(path.join(__dirname, "public")));

app.use(cors());

require("./config/passport");

// API ROUTES
let users = require("./routes/users");
app.use("/users", users);
app.use("/api/users", users);

let properties = require("./routes/properties");
app.use("/properties", properties);
app.use("/api/properties", properties);

let entries = require("./routes/entries");
app.use("/entries", entries);
app.use("/api/entries", entries);

let recorder = require("./routes/recorder");
app.use("/recorder", recorder);
app.use("/api/recorder", recorder);

let checkout = require("./routes/checkout");
app.use("/checkout", checkout);

let webhook = require("./routes/webhook");
app.use("/webhook", webhook);

let routes = require("./routes");
app.use("/", routes);

function verifyToken(req, res, next) {
  // Get auth header value
  const bearerHeader = req.headers["authorization"];
  // Check if bearer is undefined
  if (typeof bearerHeader !== "undefined") {
    // Split at the space
    const bearer = bearerHeader.split(" ");
    // Get token from array
    const bearerToken = bearer[1];
    // Set the token
    req.token = bearerToken;
    // Next middleware
    next();
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

app.listen(3030, () => {
  console.log(
    `=======================================\nServer started on port http://localhost:3030\n=======================================\n`
  );
});
