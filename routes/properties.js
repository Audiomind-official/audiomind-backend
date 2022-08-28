const express = require("express");
const router = express.Router();
const { check, validationResult, body } = require("express-validator");
const auth = require("./auth");
const sender = require("./sender");
var _ = require("lodash");
const Axios = require("axios");
const googleAPI = "AIzaSyDfOnUTm7kLg7iq69qZdM9BPALa2CGjGCI";

// HELPER FUNCTIONS
const getUser = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    return false;
  }
  return await user;
};

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

// MODELS
let Property = require("../models/property");
let History = require("../models/history");
let User = require("../models/user");
let File = require("../models/file");
let Entry = require("../models/entry");
let Invoice = require("../models/invoice");

//GET ALL PROPERTIES
router.get("/", auth.required, async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = page * limit - limit;
  const s = new RegExp(req.query.s, "g") || /(\w)/g;

  console.log(s);

  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);

    const filter = {
      CLIENT: { $or: [{ name: s }, { domain: s }], "permissions.user": id },
      ADMIN: { $or: [{ name: s }, { domain: s }] },
      AGENT: { $or: [{ name: s }, { domain: s }] },
    };

    const projection = null;

    const options = {
      sort: {
        created_at: -1,
      },
      limit,
      skip,
    };

    let count = await Property.find(
      filter[user.permissions],
      projection
    ).countDocuments();
    let properties = await Property.find(filter[user.permissions], projection)
      .setOptions(options)
      .populate("property", "name _id")
      .populate("author", "fullname _id")
      .exec();

    return await res.json({
      total_count: count,
      total_pages: Math.ceil(count / limit),
      count: properties.length,
      page: options.page,
      properties,
    });
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

// GET SINGLE PROPERTY
router.get("/:id", auth.required, async (req, res) => {
  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);
    const property = await Property.findById(req.params.id);

    if (user.permissions == "CLIENT") {
      let authorized = false;

      property.permissions.forEach((item) => {
        if (item.user.toString() == user._id.toString()) {
          authorized = true;
        }
      });

      console.log("AUTORIZADO: " + authorized);

      if (!authorized) {
        throw new Error("Access denied");
      }
    }

    return res.json(property);
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

// CREATE PROPERTY
router.post(
  "/",
  [
    auth.required,
    body("property.domain").isLength({ min: 3 }).escape(),
    body("property.name").isLength({ min: 3 }).escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let {
      body: { property },
    } = req;
    let {
      payload: { id },
    } = req;

    console.log(id);

    const user = await getUser(id);

    const newProperty = new Property(property);

    newProperty.author = id;
    newProperty.permissions = [{ user: id }];

    newProperty.save((err) => {
      if (err) {
        console.log(err);
      } else {
        res.json(newProperty);

        sender.send({
          to: user.email,
          subject: `Verifique seu site ${newProperty.name}`,
          text: `Seu site ${newProperty.name} (${newProperty.domain}) foi adicionado com sucesso, mas para começar a usar é preciso ativá-lo <a href="https://api.audiomind.com.br/properties/${newProperty._id}/activate">clicando aqui</a>.`,
        });
      }
    });
  }
);

// REENVIAR VERIFICACAO
router.get(
  "/:property/send/verification",
  [auth.optional],
  async (req, res) => {
    try {
      console.log("hi");

      const property = await Property.findById(req.params.property);
      const user = await getUser(property.author);
      console.log(`${user.email} reenviou a verificação de propriedade`);

      sender.send({
        to: user.email,
        subject: `Verifique seu site ${property.name}`,
        text: `Seu site ${property.name} (${property.domain}) foi adicionado com sucesso, mas para começar a usar é preciso ativá-lo <a href="https://api.audiomind.com.br/properties/${req.params.property}/activate">clicando aqui</a>.`,
      });

      return res.status(200).send();
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: err });
    }
  }
);

// CREATE ENTRY INTERNALLY
router.post("/:property", [auth.required], async (req, res, next) => {
  try {
    const {
      body: { entry },
    } = req;
    const {
      payload: { id },
    } = req;
    const errors = validationResult(req);
    const user = await getUser(id);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    if (user.permissions != "CLIENT") {
      const property = await Property.findById(req.params.property);

      //Create Entry
      const newEntry = new Entry(entry);

      newEntry.author = property.author;
      newEntry.property = property._id;

      newEntry.updates[0].author = id;

      await newEntry.save();

      res.json(newEntry);
    } else {
      throw new Error("Access denied");
    }
  } catch (err) {
    console.log(err);
    return res.sendStatus(500);
  }
});

// CREATE ENTRY EXTERNALLY
router.post(
  "/:property/public",
  [
    auth.optional,
    upload.single("file"),
    //body('entry.author').not().isEmpty(),
    //body('entry.updates').not().isEmpty(),
  ],
  async (req, res, next) => {
    try {
      const {
        body: { entry },
      } = req;

      const errors = validationResult(req);
      const total_duration = Math.floor(req.body.total_duration);

      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      //TODO -> CHECK FOR DOMAIN AUTHENTICITY
      console.log("CREATING ENTRY ==================================");
      const property = await Property.findById(req.params.property);
      if (!property) {
        res.status(404);
        throw new Error("Property not found");
      }
      if (property.status == "TERMINATED") {
        res.status(500);
        throw new Error("Property terminated");
      }
      if (
        property.domain !=
        req.get("origin").replace(/http:\/\/|https:\/\/|www.|\//gi, "")
      ) {
        console.log(
          req.get("origin").replace(/http:\/\/|https:\/\/|www.|\//gi, "")
        );
        res.status(500);
        throw new Error("Invalid domain");
      }

      const transcription_available =
        property.current_interval.seconds_transcripted.limit >
        property.current_interval.seconds_transcripted.used;
      const analysis_available =
        property.current_interval.entries_analysed.limit >
        property.current_interval.entries_analysed.used;

      if (!analysis_available) console.log("Sem analise");
      if (!transcription_available) console.log("Sem transcrição");

      //Uplad File
      let file = new File({
        original_name: req.file.originalname,
        location: req.file.location,
        key: req.file.key,
        content_type: req.file.contentType,
        size: req.file.size,
        property: property._id,
        author: property.author,
      });

      console.log(`File size: ${file.size}`);

      if (file.size > 8388608) {
        throw new Error("File size too big");
      }

      await file.save();

      //Create Entry
      const newEntry = new Entry(entry);

      newEntry.author = property.author;
      newEntry.property = property._id;
      newEntry.contact = {
        phone: req.body.phone,
      };
      newEntry.total_duration = req.body.total_duration;

      newEntry.info = {
        req: {
          hostname: req.hostname,
          ip: req.ip,
          protocol: req.protocol,
        },
        user_agent: req.headers["User-Agent"],
        referrer: req.headers["Referrer"],
        utm: {
          source: req.body.utm_source,
          medium: req.body.utm_medium,
          campaign: req.body.utm_campaign,
          term: req.body.utm_term,
          content: req.body.utm_content,
        },
      };

      res.status(200).send();

      // Get transcription
      let speech = null;

      if (transcription_available) {
        // Download Audio
        const reqblob = await Axios.request({
          responseType: "arraybuffer",
          url: req.file.location,
          method: "get",
          headers: {
            "Content-Type": "audio/x-wav",
          },
        });

        const audio = reqblob.data;

        const speech_req = await Axios({
          method: "post",
          url: `https://speech.googleapis.com/v1/speech:recognize?key=${googleAPI}`,
          data: {
            config: {
              languageCode: "pt-br",
            },
            audio: {
              content: audio.toString("base64"),
            },
          },
        });

        speech = speech_req.data.results[0].alternatives;
      }

      // Get entities
      let entities = null;
      let sentiment = null;

      if (analysis_available) {
        const entities_req = await Axios({
          method: "post",
          url: `https://language.googleapis.com/v1/documents:analyzeEntities?key=${googleAPI}`,
          data: {
            document: {
              type: "PLAIN_TEXT",
              language: "pt",
              content: speech[0].transcript,
            },
            encodingType: "UTF8",
          },
        });

        entities = entities_req.data.entities;

        var person = { salience: 0 };

        entities.forEach(function (element, index, array) {
          if (
            (element.type == "PERSON") &
            (element.salience > person.salience)
          ) {
            person = element;
          }
        });

        newEntry.contact.name = person.name || "";

        // Get sentiments
        const sentiments_req = await Axios({
          method: "post",
          url: `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleAPI}`,
          data: {
            document: {
              type: "PLAIN_TEXT",
              language: "pt",
              content: speech[0].transcript,
            },
            encodingType: "UTF8",
          },
        });

        sentiment = sentiments_req.data.documentSentiment;
      }

      newEntry.updates = {
        type: "file",
        file: file._id,
        speech: speech,
        sentiment: sentiment,
        entities: entities,
      };

      await newEntry.save();

      console.log("UPDATE ===============================");

      console.log("update");
      await property.update({
        $inc: {
          "current_interval.entries.used": 1,
          "current_interval.seconds_recorded.used": total_duration,
          "current_interval.seconds_transcripted.used": transcription_available
            ? total_duration
            : 0,
          "current_interval.entries_analysed.used": analysis_available ? 1 : 0,
        },
      });

      if (property.notifications) {
        sender.send({
          to: property.notifications,
          subject: `[${property.name}] Nova mensagem de áudio`,
          text: `<h1 style="text-align: left; font-size: 24px; font-weight: bold;">Nova mensagem de áudio</h1>
          Uma nova mensagem de áudio foi enviada a partir do domínio ${
            property.domain
          }\n<br><br>
          <strong>Nome:</strong> ${newEntry.contact.name || "..."}\n<br>
          <strong>Telefone:</strong> ${newEntry.contact.phone}\n<br>
          <p style="font-size: 20px; font-style: italic; margin: 32px 0; text-align: center;">“${
            newEntry.updates[0].speech[0].transcript ||
            "Sem transcrição disponível"
          }”</p>
          <a target="_blank" href="https://app.audiomind.com.br/entries/${
            newEntry._id
          }">Ver mensagem na plataforma</a> | <a href="${
            file.location
          }" target="_blank">Baixar áudio</a>`,
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ errors: [err.message] });
    }
  }
);

//GET ENTRIES FROM PROPERTY
router.get("/:property/entries", auth.required, async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = page * limit - limit;

  try {
    const {
      payload: { id },
    } = req;
    const user = await getUser(id);
    const property = await Property.findById(req.params.id);

    const filter = {
      CLIENT: { author: id, property: req.params.property },
      ADMIN: { property: req.params.property },
      AGENT: { property: req.params.property },
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

//UPDATE PROPERTY
router.put("/:property", auth.required, async (req, res, next) => {
  try {
    const {
      payload: { id },
    } = req;
    var {
      body: { property },
    } = req;
    const user = await getUser(id);

    var targetProperty = await Property.findById(req.params.property);

    if (user.permissions == "CLIENT") {
      let authorized;

      targetProperty.permissions.forEach((item) => {
        if (item.user.toString() == user._id.toString()) {
          authorized = true;
        }
      });

      if (!authorized) {
        throw new Error("Access denied");
      }
    } else {
    }

    // Filtrar objeto
    property = _.pick(property, [
      "notifications",
      "integrations",
      "domain",
      "name",
      "embed",
    ]);

    var newProperty = Object.assign(targetProperty, property);

    console.log(newProperty);

    newProperty.save();

    return res.json(newProperty);
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

// Player info
router.get("/:property/embed", [auth.optional], async (req, res) => {
  try {
    const property = await Property.findById(req.params.property);

    await property.update({
      $inc: { "metrics.hits": 1, "current_interval.hits.used": 1 },
    });

    _property = _.pick(property, ["subscription.status", "embed", "domain"]);

    return res.json(_property);
  } catch (err) {
    res.status(500).send();
  }
});

// Activate property
router.get("/:property/activate", [auth.optional], async (req, res) => {
  try {
    const property = await Property.findById(req.params.property);

    if (property.subscription.status == "NOTVERIFIED") {
      property.subscription.status = "VERIFIED";

      property.save();

      return res.redirect(
        `https://app.audiomind.com.br/properties/${req.params.property}?event=activated`
      );
    }

    return res.json("Site já foi ativado").send(500);
  } catch (err) {
    res.status(500).send();
  }
});

//GET INVOICES
router.get("/:property/invoices", auth.required, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const page = parseInt(req.query.page) || 1;
  const skip = page * limit - limit;

  try {
    const {
      payload: { id },
    } = req;

    const user = await getUser(id);
    const property = await Property.findById(req.params.property);

    if (user.permissions == "CLIENT") {
      let authorized = false;

      property.permissions.forEach((item) => {
        if (item.user.toString() == user._id.toString()) {
          authorized = true;
        }
      });

      console.log("AUTORIZADO: " + authorized);

      if (!authorized) {
        throw new Error("Access denied");
      }
    }

    const projection = null;

    const options = {
      sort: {
        created_at: -1,
      },
      limit,
      skip,
    };

    let count = await Invoice.find(
      { subscription_code: req.params.property },
      projection
    ).countDocuments();
    let invoices = await Invoice.find(
      { subscription_code: req.params.property },
      projection
    )
      .setOptions(options)
      .exec();

    return await res.json({
      total_count: count,
      total_pages: Math.ceil(count / limit),
      count: invoices.length,
      page: options.page,
      invoices,
    });
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

//GET HISTORY
router.get("/:property/history", auth.required, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const page = parseInt(req.query.page) || 1;
  const skip = page * limit - limit;

  try {
    const {
      payload: { id },
    } = req;

    const user = await getUser(id);
    const property = await Property.findById(req.params.property);

    if (user.permissions == "CLIENT") {
      let authorized = false;

      property.permissions.forEach((item) => {
        if (item.user.toString() == user._id.toString()) {
          authorized = true;
        }
      });

      console.log("AUTORIZADO: " + authorized);

      if (!authorized) {
        throw new Error("Access denied");
      }
    }

    const projection = null;

    const options = {
      sort: {
        created_at: -1,
      },
      limit,
      skip,
    };

    let count = await History.find(
      { propertyId: property._id },
      projection
    ).countDocuments();
    let snapshots = await History.find({ propertyId: property._id }, projection)
      .setOptions(options)
      .exec();

    return await res.json({
      total_count: count,
      total_pages: Math.ceil(count / limit),
      count: snapshots.length,
      page: options.page,
      snapshots,
    });
  } catch (err) {
    return res.status(403).json({ errors: [err.message] });
  }
});

module.exports = router;
