const router = require('express').Router();
const { getTags, setIntereses, getIntereses } = require('../controllers/tags.controller');
const { authMiddleware }  = require('../middlewares/auth.middleware');
const { validarIntereses } = require('../middlewares/validate.middleware');

router.get('/',               getTags);
router.get('/mis-intereses',  authMiddleware, getIntereses);
router.put('/mis-intereses',  authMiddleware, validarIntereses, setIntereses);

module.exports = router;
