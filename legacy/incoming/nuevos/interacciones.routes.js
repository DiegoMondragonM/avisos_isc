const router = require('express').Router();
const { registrarInteraccion } = require('../controllers/interacciones.controller');
const { authMiddleware }       = require('../middlewares/auth.middleware');
const { validarInteraccion }   = require('../middlewares/validate.middleware');

router.post('/', authMiddleware, validarInteraccion, registrarInteraccion);

module.exports = router;
