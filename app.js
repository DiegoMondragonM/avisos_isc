const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { limiterGeneral, limiterAuth, limiterInteracciones } = require('./src/middlewares/rateLimit.middleware');
const { validarQueryPublicacionesPublicas } = require('./src/middlewares/validate.middleware');

const app = express();

app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*');

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(limiterGeneral);

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/auth',          limiterAuth, require('./src/routes/auth.routes'));
app.use('/tags',          require('./src/routes/tags.routes'));
app.use('/publicaciones', validarQueryPublicacionesPublicas, require('./src/routes/publicaciones.routes'));
app.use('/sync',          require('./src/routes/sync.routes'));
app.use('/admin',         require('./src/routes/admin.routes'));
app.use('/dispositivos',  require('./src/routes/dispositivos.routes'));
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
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el body' });
  }
  if (err.status === 413) {
    return res.status(413).json({ error: 'Payload demasiado grande (máx 1MB)' });
  }

  console.error(`Error no manejado [${req.method} ${req.path}]:`, err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message || 'Error interno del servidor',
  });
});

module.exports = app;
