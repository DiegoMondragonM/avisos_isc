const { pool } = require('../db/pool');

// ── GET /tags ─────────────────────────────────────────────────────────────────
// Devuelve el catálogo completo de tags disponibles

async function getTags(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, slug FROM tags ORDER BY nombre ASC'
    );
    return res.json({ tags: rows });
  } catch (err) {
    console.error('getTags error:', err.message);
    return res.status(500).json({ error: 'Error al obtener tags' });
  }
}

// ── PUT /tags/mis-intereses ───────────────────────────────────────────────────
// Reemplaza todos los intereses del usuario autenticado
// Body: { tag_ids: [1, 3, 5] }

async function setIntereses(req, res) {
  const { tag_ids } = req.body;
  const usuario_id  = req.usuario.id;

  if (!Array.isArray(tag_ids)) {
    return res.status(400).json({ error: 'tag_ids debe ser un arreglo' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Borrar intereses actuales del usuario
    await client.query(
      'DELETE FROM intereses_usuario WHERE usuario_id = $1',
      [usuario_id]
    );

    // Insertar los nuevos (si mandan arreglo vacío, queda sin intereses)
    if (tag_ids.length > 0) {
      // Verificar que todos los tag_ids existan
      const { rows: tagsValidos } = await client.query(
        'SELECT id FROM tags WHERE id = ANY($1::int[])',
        [tag_ids]
      );

      if (tagsValidos.length !== tag_ids.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Uno o más tag_ids no existen' });
      }

      // Insertar cada interés
      const valores = tag_ids
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');

      await client.query(
        `INSERT INTO intereses_usuario (usuario_id, tag_id) VALUES ${valores}`,
        [usuario_id, ...tag_ids]
      );
    }

    await client.query('COMMIT');

    return res.json({ message: 'Intereses actualizados correctamente', tag_ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('setIntereses error:', err.message);
    return res.status(500).json({ error: 'Error al guardar intereses' });
  } finally {
    client.release();
  }
}

// ── GET /tags/mis-intereses ───────────────────────────────────────────────────
// Devuelve los tags del usuario autenticado

async function getIntereses(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.nombre, t.slug
       FROM tags t
       INNER JOIN intereses_usuario iu ON iu.tag_id = t.id
       WHERE iu.usuario_id = $1
       ORDER BY t.nombre ASC`,
      [req.usuario.id]
    );
    return res.json({ intereses: rows });
  } catch (err) {
    console.error('getIntereses error:', err.message);
    return res.status(500).json({ error: 'Error al obtener intereses' });
  }
}

module.exports = { getTags, setIntereses, getIntereses };
