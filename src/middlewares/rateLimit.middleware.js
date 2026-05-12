// src/middlewares/rateLimit.middleware.js
// Limita requests para evitar abuso de la API

const rateLimit = require('express-rate-limit');

// ── Límite general: todas las rutas ──────────────────────────────────────────
// 100 requests por IP cada 15 minutos
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos',
  },
});

// ── Límite estricto: rutas de auth ────────────────────────────────────────────
// 10 intentos de login/register por IP cada 15 minutos
// Evita ataques de fuerza bruta
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos',
  },
});

// ── Límite para interacciones ─────────────────────────────────────────────────
// 200 registros por IP cada 15 minutos (la app puede mandar varios seguidos)
const limiterInteracciones = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas interacciones registradas, intenta más tarde',
  },
});

module.exports = { limiterGeneral, limiterAuth, limiterInteracciones };
