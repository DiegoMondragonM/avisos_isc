const router = require('express').Router();
const { getTags, setIntereses, getIntereses } = require('../controllers/tags.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// GET  /tags                →  público (la app necesita el catálogo sin login)
router.get('/', getTags);

// GET  /tags/mis-intereses  →  protegido
router.get('/mis-intereses', authMiddleware, getIntereses);

// PUT  /tags/mis-intereses  →  protegido
router.put('/mis-intereses', authMiddleware, setIntereses);

module.exports = router;
