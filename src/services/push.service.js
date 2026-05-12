// src/services/push.service.js
// Encapsula toda la lógica de envío de push notifications via FCM

const { pool }        = require('../db/pool');
const { getFirebase } = require('../db/firebase');

/**
 * Envía una notificación push a UN token específico.
 * @param {string} token - FCM token del dispositivo
 * @param {Object} payload - { titulo, cuerpo, data }
 */
async function enviarAToken(token, { titulo, cuerpo, data = {} }) {
  const admin = getFirebase();
  const mensaje = {
    token,
    notification: {
      title: titulo,
      body:  cuerpo,
    },
    data: {
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  return admin.messaging().send(mensaje);
}

/**
 * Envía una notificación a TODOS los dispositivos activos.
 * MVP: broadcast a todos.
 * @param {Object} payload - { titulo, cuerpo, data }
 * @returns {Object} { enviados, fallidos, tokens_desactivados }
 */
async function notificarATodos({ titulo, cuerpo, data = {} }) {
  const { rows: dispositivos } = await pool.query(
    `SELECT id, token FROM dispositivos_push WHERE activo = TRUE`
  );

  if (dispositivos.length === 0) {
    console.log('📭 No hay dispositivos activos para notificar');
    return { enviados: 0, fallidos: 0, tokens_desactivados: 0 };
  }

  console.log(`📤 Enviando push a ${dispositivos.length} dispositivos...`);

  const resultado = { enviados: 0, fallidos: 0, tokens_desactivados: 0 };
  const tokensInvalidos = [];

  for (const dispositivo of dispositivos) {
    try {
      await enviarAToken(dispositivo.token, { titulo, cuerpo, data });
      resultado.enviados++;
    } catch (err) {
      resultado.fallidos++;

      // Si el token ya no es válido (app desinstalada), desactivarlo
      const esTokenInvalido =
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token';

      if (esTokenInvalido) {
        tokensInvalidos.push(dispositivo.id);
        resultado.tokens_desactivados++;
      } else {
        console.error(`  ❌ Error enviando a token ${dispositivo.id}:`, err.message);
      }
    }
  }

  // Desactivar tokens inválidos en batch
  if (tokensInvalidos.length > 0) {
    await pool.query(
      `UPDATE dispositivos_push SET activo = FALSE
       WHERE id = ANY($1::int[])`,
      [tokensInvalidos]
    );
    console.log(`  🗑️  ${tokensInvalidos.length} tokens inválidos desactivados`);
  }

  console.log(`  ✅ Push enviadas: ${resultado.enviados} | Fallidas: ${resultado.fallidos}`);
  return resultado;
}

/**
 * Envía notificación solo a usuarios con intereses que coincidan
 * con los tags de la publicación. (Upgrade del MVP)
 * @param {number} publicacion_id
 * @param {Object} payload - { titulo, cuerpo }
 */
async function notificarPorIntereses(publicacion_id, { titulo, cuerpo }) {
  // Obtener tags de la publicación
  const { rows: tagsPub } = await pool.query(
    `SELECT tag_id FROM publicacion_tags WHERE publicacion_id = $1`,
    [publicacion_id]
  );

  if (tagsPub.length === 0) {
    // Sin tags → notificar a todos
    return notificarATodos({
      titulo, cuerpo,
      data: { publicacion_id: String(publicacion_id), tipo: 'nueva_publicacion' },
    });
  }

  const tag_ids = tagsPub.map(t => t.tag_id);

  // Obtener tokens de usuarios con al menos un tag en común
  const { rows: dispositivos } = await pool.query(
    `SELECT DISTINCT dp.id, dp.token
     FROM dispositivos_push dp
     INNER JOIN intereses_usuario iu ON iu.usuario_id = dp.usuario_id
     WHERE dp.activo = TRUE
       AND iu.tag_id = ANY($1::int[])`,
    [tag_ids]
  );

  if (dispositivos.length === 0) {
    console.log('📭 Ningún usuario con intereses coincidentes tiene dispositivo activo');
    return { enviados: 0, fallidos: 0, tokens_desactivados: 0 };
  }

  console.log(`📤 Notificando a ${dispositivos.length} usuarios con intereses coincidentes...`);

  const resultado = { enviados: 0, fallidos: 0, tokens_desactivados: 0 };
  const tokensInvalidos = [];

  for (const dispositivo of dispositivos) {
    try {
      await enviarAToken(dispositivo.token, {
        titulo, cuerpo,
        data: { publicacion_id: String(publicacion_id), tipo: 'nueva_publicacion' },
      });
      resultado.enviados++;
    } catch (err) {
      resultado.fallidos++;
      const esInvalido =
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token';
      if (esInvalido) tokensInvalidos.push(dispositivo.id);
    }
  }

  if (tokensInvalidos.length > 0) {
    await pool.query(
      `UPDATE dispositivos_push SET activo = FALSE WHERE id = ANY($1::int[])`,
      [tokensInvalidos]
    );
    resultado.tokens_desactivados = tokensInvalidos.length;
  }

  return resultado;
}

module.exports = { notificarATodos, notificarPorIntereses };
