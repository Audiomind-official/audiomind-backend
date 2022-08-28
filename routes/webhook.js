const router = require("express").Router();
const sender = require("./sender");
const plans = require("./plans");
const moment = require("moment");

let Property = require("../models/property");
let User = require("../models/user");
let Invoice = require("../models/invoice");
let History = require("../models/history");

router.post("/wirecard", [], async (req, res) => {
  console.log("Wirecard Webhook Accessed..........")
  if (req.headers.authorization != "22bbfbe0920343aba530eb46f4a8b1f7") {
    res.status(401).send();
    return;
  }

  const event = {
    type: req.body.event.split(".")[0],
    action: req.body.event.split(".")[1]
  };

  
  // Implementar verificação de segurança
  console.log(req.headers.authorization);



  const resource = req.body.resource;
  resource.updated_at = new Date(
    moment(req.body.date, "DD/MM/YYYY h:mm:ss").format()
  );

  console.log(
    "\n\n\nPOST WEBHOOK ============================================="
  );
  console.log(event.type, event.action);
  console.log("Data: " + req.body.date);

  if (event.type == "subscription") subscriptions[event.action](resource);
  if (event.type == "invoice") invoices[event.action](resource);

  res.status(200).json("OK");
});

const subscriptions = {
  created: async function(resource) {
    let property = await Property.findById(resource.code);

    property.subscription = resource;
    property.save();
  },

  activated: async function(resource) {
    let property = await Property.findById(resource.code);

    let last_update = new Date(property.updated_at);

    if (last_update < resource.updated_at) {
      property.subscription.status = "ACTIVE";
      property.subscription.updated_at = resource.updated_at;
      property.save();

      sender.send({
        to: user.email,
        subject: `Assinatura para ${property.name} foi ativada`,
        text: `<p>Sua assinatura para <b>${property.name}</b> foi ativada e você já pode usar todos os serviços disponíveis no seu plano.</p>`
      });
    }
  },
  suspended: async function(resource) {
    let property = await Property.findById(resource.code);

    let last_update = new Date(property.subscription.updated_at);

    if (last_update < resource.updated_at) {
      property.subscription.status = "SUSPENDED";
      property.subscription.updated_at = resource.updated_at;
      property.save();

      sender.send({
        to: user.email,
        subject: `Assinatura para ${property.name} foi suspensa`,
        text: `<p>Sua assinatura para <b>${property.name}</b> foi suspensa. Entre em contato caso queira reativá-la.</p>`
      });
    }
  },
  canceled: async function(resource) {
    let property = await Property.findById(resource.code);

    let last_update = new Date(property.subscription.updated_at);

    if (last_update < resource.updated_at) {
      property.subscription.status = "CANCELED";
      property.subscription.updated_at = resource.updated_at;
      property.save();

      sender.send({
        to: user.email,
        subject: `Assinatura para ${property.name} foi cancelada`,
        text: `<p>Sua assinatura para <b>${property.name}</b> foi cancelada. Entre em contato caso queira reativá-la.</p>`
      });
    }
  },
  updated: async function(resource) {
    let property = await Property.findById(resource.code);

    // Acho que aqui que renova o plano => VERIFICAR
  },
  migrated: async function(resource) {
    let property = await Property.findById(resource.code);

    // Troca de plano, nao sei o q significa => VERIFICAR
  }
};

const invoices = {
  created: async function(resource) {
    let invoice = await new Invoice(resource);
    invoice.save();

    let property = await Property.findById(resource.subscription_code)
      .populate("subscription.customer.code", "email _id")
      .populate("permissions.user", "email _id")
      .populate("author", "email _id");

    console.log(property.subscription.customer);

    let email = property.author.email;

    console.log(email);

    sender.send({
      to: email,
      subject: `Aguardando pagamento`,
      text: `<p>Sua fatura no valor de R$${resource.amount / 100} para <b>${
        property.name
      }</b> foi criada. O pagamento será efetuado automaticamente pelo cartão cadastrado.</p>`
    });
  },

  status_updated: async function(resource) {
    let invoice = await Invoice.findOne({ id: resource.id });
    let last_update = new Date(invoice.updated_at);

    if (last_update < resource.updated_at) {
      let property = await Property.findById(resource.subscription_code)
        .populate("subscription.customer.code", "email _id")
        .populate("permissions.user", "email _id");

      let email = property.subscription.customer.code
        ? property.subscription.customer.code.email
        : property.author.email;

      if ((resource.status.description == "Pago")) {
        let property_update = new Date(property.current_interval.updated_at);

        if (property_update <= resource.updated_at) {

          console.log("Atualizando plano");

          usage = plans[property.subscription.plan.code];

          console.log(usage)

          let history = await new History({
            interval: property.current_interval,
            propertyId: property._id
          });

          history.save();

          property.current_interval = {
            started_at: new Date(),
            updated_at: new Date(),
            hits: {
              used: 0,
              limit: usage.hits
            },
            seconds_transcripted: {
              used: 0,
              limit: usage.seconds_transcripted
            },
            entries_analysed: {
              used: 0,
              limit: usage.entries_analysed
            },
            entries: {
              used: 0,
              limit: usage.entries
            }
          };

          property.save();

          sender.send({
            to: email,
            subject: `Plano renovado com sucesso`,
            text: `<p>Seu site <strong>${property.name}</strong> já está pronto para receber mais contatos! Para saber mais informações sobre o uso, entre na plataforma na seção do seu site e clique em Cobranças.</p>`
          });
        }
      } else {
        sender.send({
          to: email,
          subject: `Fatura atualizada: ${resource.status.description}`,
          text: `<p>Sua fatura do site <strong>${property.name}</strong> teve o status atualizado para <b>${resource.status.description}</b></p>`
        });
      }
    }
  }
};

module.exports = router;
