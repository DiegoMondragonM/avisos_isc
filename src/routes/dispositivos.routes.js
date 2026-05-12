const router = require('express').Router();
const { registrarToken, desactivarToken } = require('../controllers/dispositivos.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validarDispositivoToken } = require('../middlewares/validate.middleware');

// Todos los endpoints de dispositivos requieren token JWT
router.use(authMiddleware);

// POST   /dispositivos/token  →  registrar o actualizar token FCM
router.post('/token', validarDispositivoToken, registrarToken);

// DELETE /dispositivos/token  →  desactivar al hacer logout
router.delete('/token', validarDispositivoToken, desactivarToken);

module.exports = router;
