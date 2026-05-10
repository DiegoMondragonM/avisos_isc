const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Prueba la conexión a PostgreSQL.
 * @param {boolean} silent - Si true no imprime en consola (para /health)
 * @returns {boolean}
 */
async function testConnection(silent = false) {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    if (!silent) console.log('✅ PostgreSQL conectado:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };
