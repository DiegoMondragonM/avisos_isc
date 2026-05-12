const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { limiterGeneral, limiterAuth, limiterInteracciones } = require('./src/middlewares/rateLimit.middleware');
const {
  validarRegister,
  validarLogin,
  validarCrearPublicacion,
  validarQueryPublicaciones,
  validarInteraccion,
  validarIntereses,
} = require('./src/middlewares/validate.middleware');
const { authMiddleware, soloAdmin } = require('./src/middlewares/auth.middleware');

const app = express();

// ── Seguridad y utilidades globales ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' })); // evita payloads gigantes
app.use(limiterGeneral);                 // rate limit a toda la API

// ── Rutas de Auth (rate limit estricto) ──────────────────────────────────────
const authRouter = require('./src/routes/auth.routes');
authRouter.post('/register', validarRegister);
authRouter.post('/login',    validarLogin);
app.use('/auth', limiterAuth, authRouter);

// ── Tags ──────────────────────────────────────────────────────────────────────
const tagsRouter = require('./src/routes/tags.routes');
app.use('/tags', tagsRouter);

// ── Publicaciones (con validación de query) ───────────────────────────────────
const pubRouter = require('./src/routes/publicaciones.routes');
app.use('/publicaciones', validarQueryPublicaciones, pubRouter);

// ── Sync ──────────────────────────────────────────────────────────────────────
app.use('/sync', require('./src/routes/sync.routes'));

// ── Admin ─────────────────────────────────────────────────────────────────────
app.use('/admin', require('./src/routes/admin.routes'));

// ── Dispositivos push ─────────────────────────────────────────────────────────
app.use('/dispositivos', require('./src/routes/dispositivos.routes'));

// ── Interacciones (rate limit propio) ────────────────────────────────────────
app.use('/interacciones', limiterInteracciones, require('./src/routes/interacciones.routes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { testConnection } = require('./src/db/pool');
  const dbOk = await testConnection(true);
  res.json({
    status:    'ok',
    db:        dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    version:   require('./package.json').version,
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error handler global ──────────────────────────────────────────────────────
// Captura cualquier error que no fue manejado en los controllers
app.use((err, req, res, next) => {
  // Error de JSON mal formado
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el body' });
  }
  // Payload demasiado grande
  if (err.status === 413) {
    return res.status(413).json({ error: 'Payload demasiado grande (máx 1MB)' });
  }

  console.error(`❌ Error no manejado [${req.method} ${req.path}]:`, err.message);
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

module.exports = app;
