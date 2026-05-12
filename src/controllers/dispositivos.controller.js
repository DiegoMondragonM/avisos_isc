// src/controllers/dispositivos.controller.js

const { pool } = require('../db/pool');

// ── POST /dispositivos/token ──────────────────────────────────────────────────
// Registra o actualiza el token FCM del dispositivo del usuario.
// La app móvil llama a este endpoint al iniciar sesión o cuando FCM renueva el token.
// Body: { token, plataforma }

async function registrarToken(req, res) {
  const { token, plataforma } = req.body;
  const usuario_id = req.usuario.id;

  if (!token) {
    return res.status(400).json({ error: 'token es requerido' });
  }

  const plataformasValidas = ['android', 'ios', 'web'];
  if (plataforma && !plataformasValidas.includes(plataforma)) {
    return res.status(400).json({ error: `plataforma debe ser: ${plataformasValidas.join(', ')}` });
  }

  try {
    // Upsert: si el token ya existe lo reactiva y lo reasigna al usuario actual
    // Útil cuando el mismo celular cambia de cuenta o reinstala la app
    await pool.query(
      `INSERT INTO dispositivos_push (usuario_id, token, plataforma, activo, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (token) DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         plataforma = COALESCE(EXCLUDED.plataforma, dispositivos_push.plataforma),
         activo     = TRUE,
         updated_at = NOW()`,
      [usuario_id, token, plataforma || null]
    );

    return res.json({ message: 'Token registrado correctamente' });
  } catch (err) {
    console.error('registrarToken error:', err.message);
    return res.status(500).json({ error: 'Error al registrar token' });
  }
}

// ── DELETE /dispositivos/token ────────────────────────────────────────────────
// Desactiva el token al cerrar sesión (la app llama esto en logout)
// Body: { token }

async function desactivarToken(req, res) {
  const { token } = req.body;
  const usuario_id = req.usuario.id;

  if (!token) {
    return res.status(400).json({ error: 'token es requerido' });
  }

  try {
    await pool.query(
      `UPDATE dispositivos_push SET activo = FALSE, updated_at = NOW()
       WHERE token = $1 AND usuario_id = $2`,
      [token, usuario_id]
    );

    return res.json({ message: 'Token desactivado correctamente' });
  } catch (err) {
    console.error('desactivarToken error:', err.message);
    return res.status(500).json({ error: 'Error al desactivar token' });
  }
}

module.exports = { registrarToken, desactivarToken };
