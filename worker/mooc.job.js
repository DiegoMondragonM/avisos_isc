// worker/mooc.job.js
// Lógica de sincronización: fetch → normalizar → insertar → bitácora
// Separado del scheduler para poder ejecutarse manualmente con: npm run worker

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool }                        = require('../src/db/pool');
const { fetchTodosCursos, normalizarCurso } = require('../src/services/mooc.service');

/**
 * Ejecuta una sincronización completa del MOOC.
 * Puede llamarse desde el scheduler (cron) o manualmente (npm run worker).
 * @returns {Object} Resumen { cursos_vistos, cursos_nuevos, cursos_omitidos, error }
 */
async function ejecutarSync() {
  const log = {
    cursos_vistos:   0,
    cursos_nuevos:   0,
    cursos_omitidos: 0,
    error:           null,
  };

  console.log('─'.repeat(50));
  console.log(`🤖 Worker MOOC iniciado: ${new Date().toISOString()}`);

  try {
    // 1. Obtener todos los cursos del MOOC (con paginación automática)
    const cursos = await fetchTodosCursos();
    log.cursos_vistos = cursos.length;
    console.log(`\n📦 Total cursos obtenidos del MOOC: ${cursos.length}`);

    if (cursos.length === 0) {
      console.log('⚠️  No se obtuvieron cursos, revisa la API del MOOC');
      return log;
    }

    // 2. Insertar cada curso si no existe (ON CONFLICT DO NOTHING)
    for (const cursoCrudo of cursos) {
      const curso = normalizarCurso(cursoCrudo);

      const result = await pool.query(
        `INSERT INTO publicaciones
           (source_id, hash_origen, titulo, descripcion, tipo, fuente, estado,
            link, imagen_url, fecha_inicio, fecha_fin,
            fecha_inscripcion_inicio, fecha_inscripcion_fin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (hash_origen) DO NOTHING
         RETURNING id`,
        [
          curso.source_id,
          curso.hash_origen,
          curso.titulo,
          curso.descripcion,
          curso.tipo,
          curso.fuente,
          curso.estado,
          curso.link,
          curso.imagen_url,
          curso.fecha_inicio,
          curso.fecha_fin,
          curso.fecha_inscripcion_inicio,
          curso.fecha_inscripcion_fin,
        ]
      );

      if (result.rowCount > 0) {
        log.cursos_nuevos++;
        console.log(`  ✅ Nuevo: ${curso.titulo}`);
      } else {
        log.cursos_omitidos++;
      }
    }

  } catch (err) {
    log.error = err.message;
    console.error('\n❌ Error en worker MOOC:', err.message);
  }

  // 3. Guardar bitácora en worker_log
  try {
    await pool.query(
      `INSERT INTO worker_log (cursos_vistos, cursos_nuevos, cursos_omitidos, error)
       VALUES ($1, $2, $3, $4)`,
      [log.cursos_vistos, log.cursos_nuevos, log.cursos_omitidos, log.error]
    );
  } catch (logErr) {
    console.error('❌ Error al guardar bitácora:', logErr.message);
  }

  console.log('\n📊 Resumen:');
  console.log(`   Vistos:    ${log.cursos_vistos}`);
  console.log(`   Nuevos:    ${log.cursos_nuevos}`);
  console.log(`   Omitidos:  ${log.cursos_omitidos}`);
  if (log.error) console.log(`   Error:     ${log.error}`);
  console.log('─'.repeat(50));

  return log;
}

module.exports = { ejecutarSync };
