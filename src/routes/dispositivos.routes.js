const router = require('express').Router();
const { registrarToken, desactivarToken } = require('../controllers/dispositivos.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Todos los endpoints de dispositivos requieren token JWT
router.use(authMiddleware);

// POST   /dispositivos/token  →  registrar o actualizar token FCM
router.post('/token', registrarToken);

// DELETE /dispositivos/token  →  desactivar al hacer logout
router.delete('/token', desactivarToken);

module.exports = router;
