// APIT INTERFACE FOR CREATING NEW ENTRIES
const express = require("express");
const router = express.Router();
const { validationResult, body } = require("express-validator");
const auth = require("./auth");

// HELPER FUNCTIONS
const getUser = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    return false;
  }
  return await user;
};

// Models
let Entry = require("../models/entry");
let File = require("../models/file");
let Property = require("../models/property");
let User = require("../models/user");

// Upload requierements
const { AWS_ACCESS_KEY_ID, AWS_SECRET_KEY, AWS_REGION } = process.env;
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

// AWS CONFIG
aws.config.update({
  secretAccessKey: AWS_SECRET_KEY,
  accessKeyId: AWS_ACCESS_KEY_ID,
  region: AWS_REGION,
});

const s3 = new aws.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "lapidator",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: "TESTE" });
    },
    key: function (req, file, cb) {
      cb(null, `${Date.now().toString()}_${file.originalname}`);
    },
  }),
});

// GET FILE
router.get("/attachment/:id", auth.optional, async (req, res) => {
  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);
    const file = await File.findById(req.params.id);

    if (
      user.permissions == "CLIENT" &&
      user._id.toString() != file.author.toString()
    ) {
      throw new Error("Access denied");
    }

    const url = s3.getSignedUrl("getObject", {
      Bucket: "lapidator",
      Key: file.key,
      Expires: 10,
    });

    return res.redirect(url);
  } catch (err) {
    return res.status(500).json({ errors: [err.message] });
  }
});

//GET ALL ENTRIES
router.get("/", auth.required, async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = page * limit - limit;

  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);

    const filter = {
      CLIENT: { author: id },
      ADMIN: {},
      AGENT: {},
    };

    const projection = null;

    const options = {
      sort: {
        created_at: -1,
      },
      limit,
      skip,
    };

    let count = await Entry.find(
      filter[user.permissions],
      projection
    ).countDocuments();
    let entries = await Entry.find(filter[user.permissions], projection)
      .setOptions(options)
      .populate("property", "name _id")
      .populate("author", "fullname _id")
      .exec();

    return await res.json({
      total_count: count,
      total_pages: Math.ceil(count / limit),
      count: entries.length,
      page,
      entries,
    });
  } catch (err) {
    return res.status(500).json({ errors: [err.message] });
  }
});

//GET SINGLE ENTRY
router.get("/:entry", auth.required, async (req, res) => {
  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);

    let entries;

    if (user.permissions == "CLIENT") {
      entries = await Entry.findOne({ author: id, _id: req.params.entry })
        .populate("property", "name _id")
        .populate("updates.file")
        .populate("updates.author", "fullname _id")
        .populate("author", "fullname _id");
    } else {
      entries = await Entry.findById(req.params.entry)
        .populate("property", "name _id")
        .populate("updates.file")
        .populate("updates.author", "fullname _id")
        .populate("author", "fullname _id");
    }

    return res.json(entries);
  } catch (err) {
    return res.status(500).json({ errors: [err.message] });
  }
});

//UPDATE PROPERTY
router.put("/:entry", auth.required, async (req, res, next) => {
  try {
    const {
      payload: { id },
    } = req;
    const {
      body: { entry },
    } = req;
    const user = await getUser(id);

    let targetEntry = await Entry.findById(req.params.entry);

    Object.assign(targetEntry, entry);

    targetEntry.updates.forEach((update) => {
      console.log(update.isNew);
    });

    targetEntry.save();

    return res.json(targetEntry);
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

module.exports = router;
