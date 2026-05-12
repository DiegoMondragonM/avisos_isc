const router = require('express').Router();
const { syncPublicaciones } = require('../controllers/sync.controller');
const { validarSyncPublicaciones } = require('../middlewares/validate.middleware');

// since opcional → sin él devuelve todo (primera sync)
router.get('/publicaciones', validarSyncPublicaciones, syncPublicaciones);

module.exports = router;
