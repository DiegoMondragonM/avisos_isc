const router = require('express').Router();
const { register, login, me } = require('../controllers/auth.controller');
const { authMiddleware }      = require('../middlewares/auth.middleware');
const { validarRegister, validarLogin } = require('../middlewares/validate.middleware');

router.post('/register', validarRegister, register);
router.post('/login',    validarLogin,    login);
router.get('/me',        authMiddleware,  me);

module.exports = router;
