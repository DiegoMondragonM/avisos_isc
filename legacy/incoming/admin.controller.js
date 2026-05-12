const { pool } = require('../db/pool');
const crypto   = require('crypto');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Asigna tags a una publicación dentro de una transacción.
 * Borra los anteriores y los reinserta.
 */
async function syncTags(client, publicacion_id, tag_ids = []) {
  await client.query(
    'DELETE FROM publicacion_tags WHERE publicacion_id = $1',
    [publicacion_id]
  );

  if (tag_ids.length === 0) return;

  // Verificar que existan
  const { rows } = await client.query(
    'SELECT id FROM tags WHERE id = ANY($1::int[])',
    [tag_ids]
  );
  if (rows.length !== tag_ids.length) {
    throw { status: 400, message: 'Uno o más tag_ids no existen' };
  }

  const valores = tag_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
  await client.query(
    `INSERT INTO publicacion_tags (publicacion_id, tag_id) VALUES ${valores}`,
    [publicacion_id, ...tag_ids]
  );
}

/**
 * Devuelve una publicación completa con sus tags (para la respuesta).
 */
async function fetchPublicacion(client, id) {
  const { rows } = await client.query(
    `SELECT
       p.*,
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
    [id]
  );
  return rows[0] || null;
}

// ── POST /admin/publicaciones ─────────────────────────────────────────────────
// Crea una publicación manual en estado 'borrador'
// Body: { titulo, descripcion, tipo, link, imagen_url,
//         fecha_inicio, fecha_fin, fecha_inscripcion_inicio,
//         fecha_inscripcion_fin, tag_ids[] }

async function crearPublicacion(req, res) {
  const {
    titulo, descripcion, tipo, link, imagen_url,
    fecha_inicio, fecha_fin,
    fecha_inscripcion_inicio, fecha_inscripcion_fin,
    tag_ids = [],
  } = req.body;

  if (!titulo || !tipo) {
    return res.status(400).json({ error: 'titulo y tipo son requeridos' });
  }

  const tiposValidos = ['curso', 'concurso', 'conferencia', 'taller', 'beca', 'otro'];
  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` });
  }

  // Generar hash único para publicaciones manuales
  const hash_origen = `manual-${crypto.randomBytes(8).toString('hex')}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO publicaciones
         (titulo, descripcion, tipo, fuente, estado, link, imagen_url,
          fecha_inicio, fecha_fin, fecha_inscripcion_inicio, fecha_inscripcion_fin,
          hash_origen, autor_id)
       VALUES ($1,$2,$3,'manual','borrador',$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        titulo.trim(), descripcion || null, tipo,
        link || null, imagen_url || null,
        fecha_inicio || null, fecha_fin || null,
        fecha_inscripcion_inicio || null, fecha_inscripcion_fin || null,
        hash_origen, req.usuario.id,
      ]
    );

    const publicacion = rows[0];

    // Asignar tags si vienen
    if (tag_ids.length > 0) {
      await syncTags(client, publicacion.id, tag_ids);
    }

    await client.query('COMMIT');

    const completa = await fetchPublicacion(client, publicacion.id);
    return res.status(201).json({ publicacion: completa });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('crearPublicacion error:', err.message);
    return res.status(500).json({ error: 'Error al crear publicación' });
  } finally {
    client.release();
  }
}

// ── PUT /admin/publicaciones/:id ──────────────────────────────────────────────
// Edita campos de una publicación (solo manuales)

async function editarPublicacion(req, res) {
  const { id } = req.params;
  const {
    titulo, descripcion, tipo, link, imagen_url,
    fecha_inicio, fecha_fin,
    fecha_inscripcion_inicio, fecha_inscripcion_fin,
    tag_ids,
  } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Solo se pueden editar publicaciones manuales
    const { rows: existe } = await client.query(
      'SELECT id, fuente FROM publicaciones WHERE id = $1',
      [id]
    );
    if (existe.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    if (existe[0].fuente !== 'manual') {
      return res.status(403).json({ error: 'Solo se pueden editar publicaciones manuales' });
    }

    await client.query(
      `UPDATE publicaciones SET
         titulo                   = COALESCE($1, titulo),
         descripcion              = COALESCE($2, descripcion),
         tipo                     = COALESCE($3, tipo),
         link                     = COALESCE($4, link),
         imagen_url               = COALESCE($5, imagen_url),
         fecha_inicio             = COALESCE($6, fecha_inicio),
         fecha_fin                = COALESCE($7, fecha_fin),
         fecha_inscripcion_inicio = COALESCE($8, fecha_inscripcion_inicio),
         fecha_inscripcion_fin    = COALESCE($9, fecha_inscripcion_fin),
         updated_at               = NOW()
       WHERE id = $10`,
      [
        titulo || null, descripcion || null, tipo || null,
        link || null, imagen_url || null,
        fecha_inicio || null, fecha_fin || null,
        fecha_inscripcion_inicio || null, fecha_inscripcion_fin || null,
        id,
      ]
    );

    // Actualizar tags si vienen en el body
    if (Array.isArray(tag_ids)) {
      await syncTags(client, id, tag_ids);
    }

    await client.query('COMMIT');

    const completa = await fetchPublicacion(client, id);
    return res.json({ publicacion: completa });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('editarPublicacion error:', err.message);
    return res.status(500).json({ error: 'Error al editar publicación' });
  } finally {
    client.release();
  }
}

// ── PATCH /admin/publicaciones/:id/publicar ───────────────────────────────────
// Cambia estado de 'borrador' a 'publicada'
// Aquí en el Paso 8 se agregará el trigger de push notifications

async function publicar(req, res) {
  const { id } = req.params;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE publicaciones
       SET estado = 'publicada', updated_at = NOW()
       WHERE id = $1 AND estado = 'borrador'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      // Puede ser que no exista o que ya esté publicada
      const { rows: check } = await pool.query(
        'SELECT estado FROM publicaciones WHERE id = $1', [id]
      );
      if (check.length === 0) {
        return res.status(404).json({ error: 'Publicación no encontrada' });
      }
      return res.status(409).json({
        error: `La publicación ya está en estado '${check[0].estado}'`,
      });
    }

    // Disparar push notifications por intereses
    const { notificarPorIntereses } = require('../services/push.service');
    notificarPorIntereses(rows[0].id, {
      titulo: `📢 ${rows[0].titulo}`,
      cuerpo: rows[0].descripcion
        ? rows[0].descripcion.substring(0, 100)
        : 'Nueva publicación disponible',
    }).catch(err => console.error('Push error (no crítico):', err.message));

    return res.json({
      message:     'Publicación publicada exitosamente',
      publicacion: rows[0],
    });
  } catch (err) {
    console.error('publicar error:', err.message);
    return res.status(500).json({ error: 'Error al publicar' });
  }
}

// ── PATCH /admin/publicaciones/:id/vencer ─────────────────────────────────────
// Marca una publicación como 'vencida' (expiró)

async function vencer(req, res) {
  const { id } = req.params;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE publicaciones
       SET estado = 'vencida', updated_at = NOW()
       WHERE id = $1 AND estado = 'publicada'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      const { rows: check } = await pool.query(
        'SELECT estado FROM publicaciones WHERE id = $1', [id]
      );
      if (check.length === 0) {
        return res.status(404).json({ error: 'Publicación no encontrada' });
      }
      return res.status(409).json({
        error: `No se puede vencer una publicación en estado '${check[0].estado}'`,
      });
    }

    return res.json({ message: 'Publicación marcada como vencida', publicacion: rows[0] });
  } catch (err) {
    console.error('vencer error:', err.message);
    return res.status(500).json({ error: 'Error al vencer publicación' });
  }
}

// ── DELETE /admin/publicaciones/:id ──────────────────────────────────────────

async function eliminarPublicacion(req, res) {
  const { id } = req.params;

  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      'DELETE FROM publicaciones WHERE id = $1 RETURNING id, titulo',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    return res.json({ message: `Publicación "${rows[0].titulo}" eliminada` });
  } catch (err) {
    console.error('eliminarPublicacion error:', err.message);
    return res.status(500).json({ error: 'Error al eliminar publicación' });
  }
}

// ── GET /admin/publicaciones ──────────────────────────────────────────────────
// Listado admin: ve TODOS los estados (borrador, publicada, vencida)

async function listarTodas(req, res) {
  const { estado, tipo, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (estado) {
    params.push(estado);
    where.push(`p.estado = $${params.length}`);
  }
  if (tipo) {
    params.push(tipo);
    where.push(`p.tipo = $${params.length}`);
  }

  const whereSQL = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  params.push(parseInt(limit));
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  try {
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM publicaciones p ${whereSQL}`,
      params.slice(0, params.length - 2)
    );

    const { rows } = await pool.query(
      `SELECT
         p.id, p.titulo, p.tipo, p.fuente, p.estado,
         p.fecha_inicio, p.fecha_fin, p.created_at, p.updated_at,
         u.nombre AS autor,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', t.id, 'nombre', t.nombre, 'slug', t.slug)
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'
         ) AS tags
       FROM publicaciones p
       LEFT JOIN publicacion_tags pt ON pt.publicacion_id = p.id
       LEFT JOIN tags t ON t.id = pt.tag_id
       LEFT JOIN usuarios u ON u.id = p.autor_id
       ${whereSQL}
       GROUP BY p.id, u.nombre
       ORDER BY p.updated_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    return res.json({
      total:         parseInt(countRows[0].count),
      page:          parseInt(page),
      limit:         parseInt(limit),
      paginas:       Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
      publicaciones: rows,
    });
  } catch (err) {
    console.error('listarTodas error:', err.message);
    return res.status(500).json({ error: 'Error al listar publicaciones' });
  }
}

module.exports = {
  crearPublicacion,
  editarPublicacion,
  publicar,
  vencer,
  eliminarPublicacion,
  listarTodas,
};
