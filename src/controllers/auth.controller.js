const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../db/pool');

// ── Helpers ───────────────────────────────────────────────────────────────────

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function usuarioPublico(u) {
  return {
    id:        u.id,
    nombre:    u.nombre,
    email:     u.email,
    rol:       u.rol,
    semestre:  u.semestre,
    creado_en: u.created_at,
  };
}

// ── POST /auth/register ───────────────────────────────────────────────────────

async function register(req, res) {
  const { nombre, email, password, semestre } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, email y password son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'El password debe tener mínimo 6 caracteres' });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }

    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, semestre)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre.trim(), email.toLowerCase().trim(), hash, semestre || null]
    );

    const token = generarToken(rows[0]);
    return res.status(201).json({ token, usuario: usuarioPublico(rows[0]) });

  } catch (err) {
    console.error('register error:', err.message);
    return res.status(500).json({ error: 'Error interno al registrar usuario' });
  }
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Mismo mensaje para email incorrecto o password incorrecto (seguridad)
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario    = rows[0];
    const passwordOk = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = generarToken(usuario);
    return res.json({ token, usuario: usuarioPublico(usuario) });

  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
}

// ── GET /auth/me ──────────────────────────────────────────────────────────────

async function me(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({ usuario: usuarioPublico(rows[0]) });

  } catch (err) {
    console.error('me error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { register, login, me };
