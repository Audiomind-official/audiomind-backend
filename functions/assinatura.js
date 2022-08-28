
let Property = require('../models/property');

// Após receber infos da Wire, inicializa o plano na psf  ropriedade
const initializeSubscription = async function(subscription) {

    try {
        property = await Property.findById(subscription.code);

        
    } catch (error) {
        console.log(error)
    }


}