const passport = require('passport');
const router = require('express').Router();
const auth = require('./auth');
const sender = require('./sender');

const { check, validationResult } = require('express-validator');

// HELPER FUNCTIONS
const getUser = async (id) => {
    const user = await User.findById(id);
    if (!user) { return false; }
    return await user
}

// MODELS 
let User = require('../models/user');

// ROUTES
router.post('/authenticate', [
    check('user.email').isEmail().escape(),
    check('user.password').isLength({ min: 4 }).escape(),
], (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    
    const { body: { user } } = req;
    user.email = user.email.toLowerCase();

    return passport.authenticate('local', { session: false }, (err, passportUser, info) => {

        if (err) {
            return res.json(err);
        }

        if (passportUser) {
            const user = passportUser;
            user.token = passportUser.generateJWT();

            return res.json({ user: user.toAuthJSON() });
        }

        return res.status(400).json(info);

    })(req, res, next);

});

router.post('/register', [
    check('user.email').isEmail().escape(),
    check('user.password').isLength({ min: 8 }).escape()
], async (req, res) => {

    const { body: { user } } = req;
    const errors = validationResult(req);

    user.email = user.email.toLowerCase();

    if (!errors.isEmpty()) { return res.status(422).json({ errors: errors.array() }); }

    const newUser = new User(user);
    newUser.setPassword(user.password);
    newUser.save().then(() => {
        sender.send({
            to: user.email,
            subject: "Obrigado por se cadastrar",
            text: `<h1>Olá, ${newUser.fullname}</h1><p>Obrigado por se juntar à Audiomind! Você pode fazer acessar a plataforma clicando <a href="https://app.audiomind.com.br/">aqui</a>. `
        });

        return res.json({ user: newUser.toAuthJSON() });
    }).catch((err) => {
        return res.status(422).json({ error: err.errmsg });
    });

});

router.post('/password/request', [
    check('user.email').isEmail().escape(),
], async (req, res) => {

    const { body: { user } } = req;

    try {
        let reqUser = await User.findOne({ email: user.email })

        reqUser.setPasswordResetToken();

        const updatedUser = await reqUser.save();
        console.log(`${updatedUser.email} requested a Password Reset`);

        sender.send({
            to: user.email,
            subject: "Redefinição de senha",
            text: `<p>Você solicitou uma redefinição de senha, clique <a href="https://app.audiomind.com.br/reset?token=${updatedUser.password_reset_token}">aqui</a> para finalizar o processo.</p>`
        });

        return res.status(200).send();


    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err })
    }
    
});

router.post('/password/reset', [
    check('token').isLength({ min: 16 }).escape(),
    check('password').isLength({ min: 8 }).escape()
], async (req, res) => {

    const { body: { token, password } } = req;

    try {
        const user = await User.findOne({
            password_reset_token: token,
            password_reset_token_expires: {
                $gt: Date.now()
            }
        });


        if (user == null) return res.status(404).json({error: "Token expired"})

        user.setPassword(password);
        user.password_reset_token = null;
        user.password_reset_token_expires = null;

        user.save();

        sender.send({
            to: user.email,
            subject: "Senha redefinida",
            text: `<p>Sua troca de senha foi realizada com sucesso.</p>`
        });

        return res.status(200).send()

    } catch (err) {
        //console.error(err);
        return res.status(500)
    }
});

router.get('/current', auth.optional, (req, res, next) => {

    try {
        const { payload: { id } } = req;

        return User.findById(id)
            .then((user) => {
                if (!user) {
                    return res.sendStatus(400);
                }

                return res.json({ user: user.toAuthJSON() });
            });

    } catch (err) {
        console.log(err);
    }
});

router.get('/', auth.required, async (req, res, next) => {

    try {

        const { payload: { id } } = req
        const user = await getUser(id)

        // ERROR HANDLING
        if (user.permissions != 'ADMIN') {
            throw new Error('Access denied')
        }

        // RETURN USERS
        const users = await User.find({}, '-salt -hash')
        return res.json(users)

    } catch (err) {
        return res.status(403).json({ errors: [err.message] })
    }
});

//UPDATE USER INFORMATION 
router.put('/:user', auth.required, async (req, res, next) => {

    try {

        const targetId = req.params.user
        const { payload: { id } } = req
        const { body: { user } } = req
        const currentUser = await getUser(id)

        // ERROR HANDLING
        if (targetId != id && currentUser.permissions != 'ADMIN') {
            throw new Error('Access denied')
        }

        // GET TARGET USER OBJECT
        const targetUser = await getUser(targetId)

        if (user.permissions) { targetUser.permissions = user.permissions }

        console.log(targetUser)
        console.log(currentUser)

        targetUser.save();

        return res.json(targetUser)


    } catch (err) {
        return res.status(403).json({ errors: [err.message] })
    }
});





module.exports = router;