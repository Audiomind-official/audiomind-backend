const { check, validationResult } = require("express-validator");
const router = require("express").Router();
const Axios = require("axios");
const auth = require("./auth");

let User = require("../models/user");
let Property = require("../models/property");

/*
const wirecard = Axios.create({
  baseURL: "https://sandbox.moip.com.br/assinaturas/v1",
  auth: {
    username: "USW2CTKWMORYBMDVUUUUDWK6AXJPDHBB",
    password: "EW0FRGTADPIODTHHKLR8TQCFWJFKBSPKOSLZOIUJ",
  },
});
*/

const wirecard = Axios.create({
  baseURL: "https://api.moip.com.br/assinaturas/v1",
  auth: {
    username: "FSHNH5SBBYKKAMAR6N2MOMGKDQAZVASZ",
    password: "TL2ETP69TNTW8J7PA1O2J1IHTTEDDP1YW0YTYTTR",
  },
});

router.get("/coupon/:coupon", [auth.required], async (req, res) => {
  try {
    const coupon = await wirecard({
      method: "GET",
      url: `/coupons/${req.params.coupon}`,
    });

    if (coupon.data.status != "ACTIVE") throw new Error("Coupon inactive");

    return res.json(coupon.data);
  } catch (error) {
    console.log(error);
    res.status(404).send();
  }
});
router.get("/cep/:zip", [], async (req, res) => {
  const address = await Axios.get(
    `http://viacep.com.br/ws/${req.params.zip}/json/`
  );

  return res.json(address.data);
});

router.post("/purchase", [auth.required], async (req, res) => {
  let {
    payload: { id },
  } = req;
  let {
    body: { property, credit_card, plan_code, customer, coupon },
  } = req;

  try {
    customer = await getCustomer(id, customer);

    if (!customer) {
      throw "Customer inválido";
    }

    const payment = await updateBillingInfos(id, credit_card);

    if (!payment) {
      throw "Pagamento inválido";
    }

    subscription = await createSubscription(
      property,
      customer,
      plan_code,
      coupon
    );

    if (subscription.errors.length > 0) throw subscription.errors;

    let propertyUpdated = await Property.findById(property);
    propertyUpdated.subscription = subscription;
    await propertyUpdated.save();

    console.log(propertyUpdated.subscription);

    return res.json(subscription);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ errors: error });
  }
});

const getCustomer = async function (
  id,
  customer = {},
  returnFullCustomer = false
) {
  try {
    // Verifica se já criou usuário na Wirecard
    let user = await User.findById(id);

    if (user.billing.customer.code) {
      console.log("Wirecard customer exists");
      // Retorna Customer Completo
      if (returnFullCustomer) {
        const customerReq = await wirecard({
          method: "GET",
          url: `/customers/${user.billing.customer.code}`,
          data: customer,
        });

        return customerReq.data;
      }

      // Retorna só o ID
      return id;
    }

    // Se não, cria:

    console.log("Creating Wirecard customer for" + id);
    customer.code = id;

    const customerReq = await wirecard({
      method: "POST",
      url: "/customers",
      data: customer,
    });

    // Atualiza Customer no User
    user.billing = { customer: customer };
    user.save();

    if (returnFullCustomer) {
      // Retorna Customer Completo
      return user.billing.customer;
    } else {
      // Retorna só o ID
      return id;
    }
  } catch (error) {
    console.log(error.response.data);
    return false;
  }
};

const createSubscription = async function (
  propertyId,
  customer,
  plan_code,
  coupon = null
) {
  try {
    console.log("Starting subscription creation");

    let property = Property.findById(propertyId);

    //Verificar se ta certo
    if (property == null) throw "Propriedade inválida";

    console.log(coupon);

    let data = {
      code: propertyId,
      payment_method: "CREDIT_CARD",
      plan: {
        code: plan_code,
      },
      customer: {
        code: customer,
      }
    };

    if (coupon) {
      data.coupon = {
        code: coupon,
      };
    }

    const subscriptionReq = await wirecard({
      method: "POST",
      url: "/subscriptions?new_customer=false",
      data: data,
    });

    console.log("Finishing subscription creation");

    return subscriptionReq.data;
  } catch (error) {
    console.log(error.response.data);
    return error.response.data;
  }
};

const updateBillingInfos = async function (id, credit_card) {
  try {
    console.log("Updating billing info");

    const customerReq = await wirecard({
      method: "PUT",
      url: `/customers/${id}/billing_infos`,
      data: {
        credit_card: credit_card,
      },
    });

    console.log(customerReq.data);

    return true;
  } catch (error) {
    console.log(error.response.data);
    return false;
  }
};

module.exports = router;
