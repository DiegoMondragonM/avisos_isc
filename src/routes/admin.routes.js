const router = require('express').Router();
const {
  crearPublicacion,
  editarPublicacion,
  publicar,
  vencer,
  eliminarPublicacion,
  listarTodas,
} = require('../controllers/admin.controller');
const { authMiddleware, soloAdmin } = require('../middlewares/auth.middleware');

// Todas las rutas de admin requieren JWT válido + rol admin
router.use(authMiddleware, soloAdmin);

// GET    /admin/publicaciones               → listar todas (todos los estados)
router.get('/publicaciones', listarTodas);

// POST   /admin/publicaciones               → crear manual (entra como borrador)
router.post('/publicaciones', crearPublicacion);

// PUT    /admin/publicaciones/:id           → editar
router.put('/publicaciones/:id', editarPublicacion);

// PATCH  /admin/publicaciones/:id/publicar  → borrador → publicada
router.patch('/publicaciones/:id/publicar', publicar);

// PATCH  /admin/publicaciones/:id/vencer    → publicada → vencida
router.patch('/publicaciones/:id/vencer', vencer);

// DELETE /admin/publicaciones/:id           → eliminar
router.delete('/publicaciones/:id', eliminarPublicacion);

module.exports = router;
