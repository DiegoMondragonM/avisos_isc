// src/controllers/interacciones.controller.js

const { pool } = require('../db/pool');

const TIPOS_VALIDOS = ['view_detail', 'open_link', 'favorite', 'tap_notification'];

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

// ── POST /interacciones ───────────────────────────────────────────────────────
// La app móvil llama esto cada vez que el usuario interactúa con una publicación
// Body: { publicacion_id, tipo_evento }

async function registrarInteraccion(req, res) {
  const { publicacion_id, tipo_evento } = req.body;
  const publicacionId = parsePositiveInt(publicacion_id);
  const usuario_id = req.usuario.id;

  if (!publicacion_id || !tipo_evento) {
    return res.status(400).json({ error: 'publicacion_id y tipo_evento son requeridos' });
  }
  if (!publicacionId) {
    return res.status(400).json({ error: 'publicacion_id debe ser un entero positivo' });
  }

  if (!TIPOS_VALIDOS.includes(tipo_evento)) {
    return res.status(400).json({
      error: `tipo_evento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`,
    });
  }

  try {
    // Verificar que la publicación exista
    const { rows: pub } = await pool.query(
      'SELECT id FROM publicaciones WHERE id = $1',
      [publicacionId]
    );
    if (pub.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    await pool.query(
      `INSERT INTO interacciones (usuario_id, publicacion_id, tipo_evento)
       VALUES ($1, $2, $3)`,
      [usuario_id, publicacionId, tipo_evento]
    );

    return res.status(201).json({ message: 'Interacción registrada' });
  } catch (err) {
    console.error('registrarInteraccion error:', err.message);
    return res.status(500).json({ error: 'Error al registrar interacción' });
  }
}

// ── GET /admin/metricas ───────────────────────────────────────────────────────
// Reporte general para el panel admin
// Query params: desde, hasta (fechas ISO, opcionales)

async function getMetricas(req, res) {
  const { desde, hasta } = req.query;

  // Rango de fechas opcional — default: últimos 30 días
  const fechaDesde = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fechaHasta = hasta ? new Date(hasta)  : new Date();

  if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
    return res.status(400).json({ error: 'Formato de fecha inválido. Usa ISO 8601' });
  }
  if (fechaDesde > fechaHasta) {
    return res.status(400).json({ error: 'desde no puede ser mayor que hasta' });
  }

  try {
    // 1. Total de interacciones por tipo
    const { rows: porTipo } = await pool.query(
      `SELECT tipo_evento, COUNT(*) AS total
       FROM interacciones
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY tipo_evento
       ORDER BY total DESC`,
      [fechaDesde, fechaHasta]
    );

    // 2. Top 10 publicaciones más vistas
    const { rows: topPublicaciones } = await pool.query(
      `SELECT
         p.id, p.titulo, p.tipo, p.fuente,
         COUNT(i.id) AS total_interacciones,
         COUNT(i.id) FILTER (WHERE i.tipo_evento = 'view_detail')    AS vistas,
         COUNT(i.id) FILTER (WHERE i.tipo_evento = 'open_link')      AS clics,
         COUNT(i.id) FILTER (WHERE i.tipo_evento = 'favorite')       AS favoritos,
         COUNT(i.id) FILTER (WHERE i.tipo_evento = 'tap_notification') AS tap_notif
       FROM publicaciones p
       LEFT JOIN interacciones i ON i.publicacion_id = p.id
         AND i.created_at BETWEEN $1 AND $2
       WHERE p.estado = 'publicada'
       GROUP BY p.id
       ORDER BY total_interacciones DESC
       LIMIT 10`,
      [fechaDesde, fechaHasta]
    );

    // 3. Interacciones por día (para gráfica de tendencia)
    const { rows: porDia } = await pool.query(
      `SELECT
         DATE(created_at) AS dia,
         COUNT(*) AS total
       FROM interacciones
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY dia
       ORDER BY dia ASC`,
      [fechaDesde, fechaHasta]
    );

    // 4. Interacciones por tipo de publicación
    const { rows: porTipoPub } = await pool.query(
      `SELECT
         p.tipo,
         COUNT(i.id) AS total_interacciones
       FROM interacciones i
       INNER JOIN publicaciones p ON p.id = i.publicacion_id
       WHERE i.created_at BETWEEN $1 AND $2
       GROUP BY p.tipo
       ORDER BY total_interacciones DESC`,
      [fechaDesde, fechaHasta]
    );

    // 5. Resumen general
    const { rows: resumen } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM publicaciones WHERE estado = 'publicada')          AS total_publicaciones,
         (SELECT COUNT(*) FROM publicaciones WHERE estado = 'borrador')            AS total_borradores,
         (SELECT COUNT(*) FROM publicaciones WHERE fuente = 'mooc')               AS total_mooc,
         (SELECT COUNT(*) FROM publicaciones WHERE fuente = 'manual')             AS total_manuales,
         (SELECT COUNT(*) FROM usuarios)                                           AS total_usuarios,
         (SELECT COUNT(*) FROM dispositivos_push WHERE activo = TRUE)             AS dispositivos_activos,
         (SELECT COUNT(*) FROM interacciones WHERE created_at BETWEEN $1 AND $2)  AS interacciones_periodo`
      ,
      [fechaDesde, fechaHasta]
    );

    return res.json({
      periodo: {
        desde: fechaDesde.toISOString(),
        hasta: fechaHasta.toISOString(),
      },
      resumen:          resumen[0],
      por_tipo_evento:  porTipo,
      top_publicaciones: topPublicaciones,
      por_dia:          porDia,
      por_tipo_publicacion: porTipoPub,
    });
  } catch (err) {
    console.error('getMetricas error:', err.message);
    return res.status(500).json({ error: 'Error al obtener métricas' });
  }
}

module.exports = { registrarInteraccion, getMetricas };
