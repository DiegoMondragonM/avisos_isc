const router = require('express').Router();
const { register, login, me } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/register', register);          // público
router.post('/login',    login);             // público
router.get('/me',        authMiddleware, me); // protegido

module.exports = router;
