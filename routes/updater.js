
const router = require("express").Router();

const plans = require('./plans');

let Property = require('../models/property');
let History = require('../models/history');

const updater = {
    updateInterval(property_id, plan_code, plan = false) {
        
        if (this.checkDuplicity() ) {

            let property = await Property.findById(property_id);//resource.code);


            let history = await new History(property.current_interval)
                history.save()

            property.current_interval = {
                updated_at: new Date(),
                hits: {
                    used: 0,
                    limit: plan ? plan.hits : plans[plan_code].hits,
                },
                seconds_transcripted: {
                    used: 0,
                    limit: plan ? plan.seconds_transcripted : plans[plan_code].seconds_transcripted,
                },
                entries_analysed: {
                    used: 0,
                    limit: plan ? plan.entries_analysed : plans[plan_code].entries_analysed,
                },
                entries: {
                    used: 0,
                    limit: plan ? plan.entries : plans[plan_code].entries,
                },
            }

            property.save()

        }

    },

    checkDuplicity(resource_date, last_update) {
        return true
    }
}


router.post("/purchase", [auth.required], async (req, res) => {
});
module.exports = updater