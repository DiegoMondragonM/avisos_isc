// src/middlewares/validate.middleware.js
// Valida los inputs de cada endpoint antes de llegar al controller.
// Si algo falla responde 400 inmediatamente sin tocar la BD.

// ── Helpers ───────────────────────────────────────────────────────────────────

function esFechaValida(str) {
  if (!str) return true; // opcionales pasan
  return !isNaN(new Date(str).getTime());
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esEnteroPositivo(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function validarRegister(req, res, next) {
  if (req.body.nombre !== undefined) req.body.nombre = trimString(req.body.nombre);
  if (req.body.email !== undefined) req.body.email = trimString(req.body.email).toLowerCase();

  const { nombre, email, password, semestre } = req.body;
  const errores = [];

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    errores.push('nombre debe tener al menos 2 caracteres');
  }
  if (!email || !esEmailValido(email)) {
    errores.push('email inválido');
  }
  if (!password || password.length < 6) {
    errores.push('password debe tener al menos 6 caracteres');
  }
  if (semestre !== undefined && (isNaN(semestre) || semestre < 1 || semestre > 20)) {
    errores.push('semestre debe ser un número entre 1 y 20');
  }

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
  next();
}

function validarLogin(req, res, next) {
  if (req.body.email !== undefined) req.body.email = trimString(req.body.email).toLowerCase();

  const { email, password } = req.body;
  const errores = [];

  if (!email || !esEmailValido(email)) errores.push('email inválido');
  if (!password || password.length < 1) errores.push('password requerido');

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
  next();
}

// ── Publicaciones ─────────────────────────────────────────────────────────────

const TIPOS_VALIDOS   = ['curso', 'concurso', 'conferencia', 'taller', 'beca', 'otro'];
const ESTADOS_VALIDOS = ['borrador', 'publicada', 'vencida', 'eliminada'];

function validarCrearPublicacion(req, res, next) {
  if (req.body.titulo !== undefined) req.body.titulo = trimString(req.body.titulo);

  const {
    titulo, tipo, fecha_inicio, fecha_fin,
    fecha_inscripcion_inicio, fecha_inscripcion_fin,
    tag_ids,
  } = req.body;
  const errores = [];

  if (!titulo || typeof titulo !== 'string' || titulo.trim().length < 3) {
    errores.push('titulo debe tener al menos 3 caracteres');
  }
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    errores.push(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (!esFechaValida(fecha_inicio)) errores.push('fecha_inicio inválida');
  if (!esFechaValida(fecha_fin))    errores.push('fecha_fin inválida');
  if (!esFechaValida(fecha_inscripcion_inicio)) errores.push('fecha_inscripcion_inicio inválida');
  if (!esFechaValida(fecha_inscripcion_fin))    errores.push('fecha_inscripcion_fin inválida');

  if (fecha_inicio && fecha_fin && new Date(fecha_inicio) > new Date(fecha_fin)) {
    errores.push('fecha_inicio no puede ser mayor a fecha_fin');
  }
  if (tag_ids !== undefined && !Array.isArray(tag_ids)) {
    errores.push('tag_ids debe ser un arreglo');
  }

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
  next();
}

// ── Query params de listados ──────────────────────────────────────────────────

function validarQueryPublicaciones(req, res, next) {
  const { tipo, fuente, estado, page, limit } = req.query;
  const errores = [];

  if (tipo   && !TIPOS_VALIDOS.includes(tipo))     errores.push(`tipo inválido: ${TIPOS_VALIDOS.join(', ')}`);
  if (fuente && !['mooc', 'manual'].includes(fuente)) errores.push('fuente debe ser mooc o manual');
  if (estado && !ESTADOS_VALIDOS.includes(estado)) errores.push(`estado inválido: ${ESTADOS_VALIDOS.join(', ')}`);
  if (page && !esEnteroPositivo(page)) errores.push('page debe ser un número mayor a 0');
  if (limit && (!esEnteroPositivo(limit) || Number(limit) > 100)) {
    errores.push('limit debe ser un número entre 1 y 100');
  }

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
  next();
}

function validarQueryPublicacionesPublicas(req, res, next) {
  if (req.query.estado && req.query.estado !== 'publicada') {
    return res.status(400).json({ error: 'estado no permitido en rutas públicas' });
  }

  req.query.estado = 'publicada';
  return validarQueryPublicaciones(req, res, next);
}

// ── Sync ─────────────────────────────────────────────────────────────────────

function validarSyncPublicaciones(req, res, next) {
  const { since } = req.query;

  if (since && !esFechaValida(since)) {
    return res.status(400).json({ error: 'since debe ser una fecha ISO 8601 válida' });
  }

  next();
}

// ── Interacciones ─────────────────────────────────────────────────────────────

const EVENTOS_VALIDOS = ['view_detail', 'open_link', 'favorite', 'tap_notification'];

function validarInteraccion(req, res, next) {
  const { publicacion_id, tipo_evento } = req.body;
  const errores = [];

  if (!publicacion_id || !esEnteroPositivo(publicacion_id)) {
    errores.push('publicacion_id debe ser un número válido');
  }
  if (!tipo_evento || !EVENTOS_VALIDOS.includes(tipo_evento)) {
    errores.push(`tipo_evento debe ser uno de: ${EVENTOS_VALIDOS.join(', ')}`);
  }

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
  next();
}

// ── Tags / intereses ──────────────────────────────────────────────────────────

function validarIntereses(req, res, next) {
  const { tag_ids } = req.body;

  if (!Array.isArray(tag_ids)) {
    return res.status(400).json({ error: 'tag_ids debe ser un arreglo' });
  }
  if (tag_ids.some(id => !esEnteroPositivo(id))) {
    return res.status(400).json({ error: 'Todos los tag_ids deben ser números válidos' });
  }

  next();
}

// ── Dispositivos push ────────────────────────────────────────────────────────

function validarDispositivoToken(req, res, next) {
  const { token, plataforma } = req.body;
  const plataformasValidas = ['android', 'ios', 'web'];
  const errores = [];

  if (!token || typeof token !== 'string' || token.trim().length < 20) {
    errores.push('token debe ser un string de al menos 20 caracteres');
  }
  if (typeof token === 'string' && token.length > 4096) {
    errores.push('token no debe exceder 4096 caracteres');
  }
  if (plataforma !== undefined && !plataformasValidas.includes(plataforma)) {
    errores.push(`plataforma debe ser: ${plataformasValidas.join(', ')}`);
  }

  if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });

  req.body.token = token.trim();
  next();
}

module.exports = {
  validarRegister,
  validarLogin,
  validarCrearPublicacion,
  validarQueryPublicaciones,
  validarQueryPublicacionesPublicas,
  validarSyncPublicaciones,
  validarInteraccion,
  validarIntereses,
  validarDispositivoToken,
};
