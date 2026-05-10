const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const app = express();

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/auth',          require('./src/routes/auth.routes'));
app.use('/tags',          require('./src/routes/tags.routes'));
app.use('/publicaciones', require('./src/routes/publicaciones.routes'));
app.use('/sync',          require('./src/routes/sync.routes'));
app.use('/admin',         require('./src/routes/admin.routes'));
app.use('/dispositivos',  require('./src/routes/dispositivos.routes'));
app.use('/interacciones', require('./src/routes/interacciones.routes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { testConnection } = require('./src/db/pool');
  const dbOk = await testConnection(true);
  res.json({
    status:    'ok',
    db:        dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

module.exports = app;
