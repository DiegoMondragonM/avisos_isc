const { pool } = require('../db/pool');

// ── GET /publicaciones ────────────────────────────────────────────────────────
// Filtros opcionales: tipo, fuente, tag (slug), estado, page, limit

async function getPublicaciones(req, res) {
  const {
    tipo,
    fuente,
    tag,
    estado  = 'publicada', // por defecto solo las publicadas
    page    = 1,
    limit   = 20,
  } = req.query;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return res.status(400).json({ error: 'page debe ser un número entero mayor o igual a 1' });
  }
  if (!Number.isInteger(limitNumber) || limitNumber < 1) {
    return res.status(400).json({ error: 'limit debe ser un número entero mayor o igual a 1' });
  }

  const offset = (pageNumber - 1) * limitNumber;
  const params = [];
  const where  = [];

  // Filtro estado
  params.push(estado);
  where.push(`p.estado = $${params.length}`);

  // Filtro tipo
  if (tipo) {
    params.push(tipo);
    where.push(`p.tipo = $${params.length}`);
  }

  // Filtro fuente
  if (fuente) {
    params.push(fuente);
    where.push(`p.fuente = $${params.length}`);
  }

  // Filtro por tag (slug)
  if (tag) {
    params.push(tag);
    where.push(`
      EXISTS (
        SELECT 1 FROM publicacion_tags pt
        INNER JOIN tags t ON t.id = pt.tag_id
        WHERE pt.publicacion_id = p.id AND t.slug = $${params.length}
      )
    `);
  }

  const whereSQL = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Params para limit y offset
  params.push(limitNumber);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  try {
    // Total para paginación
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM publicaciones p ${whereSQL}`,
      params.slice(0, params.length - 2)
    );
    const total = parseInt(countRows[0].count);

    // Publicaciones con sus tags
    const { rows } = await pool.query(
      `SELECT
         p.id, p.titulo, p.descripcion, p.tipo, p.fuente, p.estado,
         p.link, p.imagen_url,
         p.fecha_inicio, p.fecha_fin,
         p.fecha_inscripcion_inicio, p.fecha_inscripcion_fin,
         p.created_at, p.updated_at,
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
       ORDER BY p.updated_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    return res.json({
      total,
      page:     pageNumber,
      limit:    limitNumber,
      paginas:  Math.ceil(total / limitNumber),
      publicaciones: rows,
    });
  } catch (err) {
    console.error('getPublicaciones error:', err.message);
    return res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
}

// ── GET /publicaciones/:id ────────────────────────────────────────────────────

async function getPublicacionById(req, res) {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber < 1) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.titulo, p.descripcion, p.tipo, p.fuente, p.estado,
         p.link, p.imagen_url,
         p.fecha_inicio, p.fecha_fin,
         p.fecha_inscripcion_inicio, p.fecha_inscripcion_fin,
         p.hash_origen, p.created_at, p.updated_at,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', t.id, 'nombre', t.nombre, 'slug', t.slug)
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'
         ) AS tags
       FROM publicaciones p
       LEFT JOIN publicacion_tags pt ON pt.publicacion_id = p.id
       LEFT JOIN tags t ON t.id = pt.tag_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [idNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    return res.json({ publicacion: rows[0] });
  } catch (err) {
    console.error('getPublicacionById error:', err.message);
    return res.status(500).json({ error: 'Error al obtener publicación' });
  }
}

module.exports = { getPublicaciones, getPublicacionById };
