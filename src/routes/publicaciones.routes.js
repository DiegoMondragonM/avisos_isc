const router = require('express').Router();
const { getPublicaciones, getPublicacionById } = require('../controllers/publicaciones.controller');

// GET /publicaciones?tipo=&fuente=&tag=&estado=&page=&limit=
router.get('/', getPublicaciones);

// GET /publicaciones/:id
router.get('/:id', getPublicacionById);

module.exports = router;
