const { pool } = require('../db/pool');

// ── GET /sync/publicaciones?since= ────────────────────────────────────────────
// Si 'since' viene → devuelve publicaciones modificadas después de esa fecha,
// incluyendo las que la app debe quitar de su almacenamiento local.
// Si 'since' NO viene → primera sync, devuelve todas las publicadas
//
// La app móvil guarda el timestamp de la última sync y lo manda en cada request.
// Así solo baja los cambios, no todo el catálogo cada vez.

async function syncPublicaciones(req, res) {
  const { since } = req.query;

  const params = [];
  let whereSQL  = `WHERE p.estado = 'publicada'`;

  if (since) {
    // Validar que sea una fecha válida
    const fecha = new Date(since);
    if (isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Usa ISO 8601: 2024-01-01T00:00:00Z' });
    }
    params.push(fecha.toISOString());
    whereSQL = `WHERE p.estado IN ('publicada', 'vencida', 'eliminada') AND p.updated_at > $${params.length}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.titulo, p.descripcion, p.tipo, p.fuente, p.estado,
         p.link, p.imagen_url,
         p.fecha_inicio, p.fecha_fin,
         p.fecha_inscripcion_inicio, p.fecha_inscripcion_fin,
         p.hash_origen, p.created_at, p.updated_at, p.deleted_at,
         CASE
           WHEN p.estado IN ('vencida', 'eliminada') THEN 'remove'
           ELSE 'upsert'
         END AS sync_action,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', t.id, 'nombre', t.nombre, 'slug', t.slug)
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'
         ) AS tags
       FROM publicaciones p
       LEFT JOIN publicacion_tags pt ON pt.publicacion_id = p.id
       LEFT JOIN tags t ON t.id = pt.tag_id
       ${whereSQL}
       GROUP BY p.id
       ORDER BY p.updated_at ASC`,
      params
    );

    return res.json({
      sync_at:       new Date().toISOString(), // la app guarda este valor para el próximo since
      total_cambios: rows.length,
      publicaciones: rows,
    });
  } catch (err) {
    console.error('syncPublicaciones error:', err.message);
    return res.status(500).json({ error: 'Error al sincronizar publicaciones' });
  }
}

module.exports = { syncPublicaciones };
