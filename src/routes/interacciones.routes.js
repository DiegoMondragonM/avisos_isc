const router = require('express').Router();
const { registrarInteraccion } = require('../controllers/interacciones.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validarInteraccion } = require('../middlewares/validate.middleware');

// POST /interacciones  →  registrar evento del usuario
router.post('/', authMiddleware, validarInteraccion, registrarInteraccion);

module.exports = router;
