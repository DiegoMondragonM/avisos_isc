const jwt = require('jsonwebtoken');

/**
 * Verifica JWT en el header Authorization: Bearer <token>
 * Agrega req.usuario = { id, email, rol } si es válido
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Solo permite acceso a usuarios con rol 'admin'.
 * Usar DESPUÉS de authMiddleware.
 */
function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
}

module.exports = { authMiddleware, soloAdmin };
