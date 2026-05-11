// src/services/mooc.service.js
// Responsable de comunicarse con la API pública del MOOC TecNM (Open edX)

const MOOC_BASE = 'https://mooc.tecnm.mx';
const MOOC_API  = `${MOOC_BASE}/api/courses/v1/courses/`;

function toAbsoluteMoocUrl(uri) {
  if (!uri) return null;
  return uri.startsWith('http') ? uri : `${MOOC_BASE}${uri}`;
}

function normalizarFechaMooc(value) {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  const iso = date.toISOString();
  const dateOnly = iso.slice(0, 10);
  const dummyDates = new Set(['1900-01-01', '2038-01-01']);

  return dummyDates.has(dateOnly) ? null : iso;
}

/**
 * Obtiene TODOS los cursos del MOOC paginando automáticamente.
 * Usa page_size=100 para minimizar el número de requests.
 * @returns {Array} Lista completa de cursos
 */
async function fetchTodosCursos() {
  const cursos = [];
  let url = `${MOOC_API}?page_size=100`;
  let pagina = 1;

  while (url) {
    console.log(`  📄 Fetching página ${pagina}: ${url}`);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al consultar MOOC API`);
    }

    const data = await res.json();
    const resultados = data.results || [];
    cursos.push(...resultados);

    console.log(`  → ${resultados.length} cursos en esta página (total acumulado: ${cursos.length})`);

    // Open edX devuelve pagination.next con la URL completa de la siguiente página
    url = data.pagination?.next || null;
    pagina++;
  }

  return cursos;
}

/**
 * Normaliza un curso de Open edX al formato de la tabla publicaciones.
 * Mapea los campos disponibles y construye el hash_origen único.
 * @param {Object} curso - Objeto crudo de la API Open edX
 * @returns {Object} Publicación normalizada lista para insertar
 */
function normalizarCurso(curso) {
  // El course_id viene así: "course-v1:TecNM+ISC101+2025_1"
  const source_id = curso.course_id || curso.id;
  const hash_origen = source_id;

  // Imagen: Open edX puede variar la estructura según versión/configuración.
  const imagen_url = toAbsoluteMoocUrl(
    curso.media?.course_image?.uri ||
    curso.media?.image?.raw ||
    curso.media?.image?.large ||
    curso.media?.image?.small
  );

  // Fechas: Open edX las manda en ISO 8601; algunas instalaciones usan sentinels.
  const fecha_inicio = normalizarFechaMooc(curso.start);
  const fecha_fin    = normalizarFechaMooc(curso.end);

  // URL del curso en el MOOC
  const link = curso.course_url
    ? (curso.course_url.startsWith('http') ? curso.course_url : `${MOOC_BASE}${curso.course_url}`)
    : `${MOOC_BASE}/courses/${hash_origen}/about`;

  return {
    source_id,
    hash_origen,
    titulo:       curso.name || 'Sin título',
    descripcion:  curso.short_description || curso.overview || null,
    tipo:         'curso',
    fuente:       'mooc',
    estado:       'publicada',   // cursos MOOC entran directo como publicados
    link,
    imagen_url,
    fecha_inicio,
    fecha_fin,
    fecha_inscripcion_inicio: normalizarFechaMooc(curso.enrollment_start),
    fecha_inscripcion_fin:    normalizarFechaMooc(curso.enrollment_end),
  };
}

module.exports = { fetchTodosCursos, normalizarCurso };
