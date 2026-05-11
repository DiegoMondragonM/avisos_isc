const router = require('express').Router();
const { syncPublicaciones } = require('../controllers/sync.controller');

// since opcional → sin él devuelve todo (primera sync)
router.get('/publicaciones', syncPublicaciones);

module.exports = router;
