require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

async function runMigrations() {
  const client = await pool.connect();

  // Tabla de control para rastrear migraciones aplicadas
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre      VARCHAR(255) PRIMARY KEY,
      aplicada_en TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const archivos = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migraciones WHERE nombre = $1', [archivo]
    );
    if (rows.length > 0) {
      console.log(`⏭️  Ya aplicada: ${archivo}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(__dirname, archivo), 'utf8');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
      console.log(`✅ Migración aplicada: ${archivo}`);
    } catch (err) {
      console.error(`❌ Error en ${archivo}:`, err.message);
      process.exit(1);
    }
  }

  client.release();
  console.log('🎉 Migraciones listas');
  process.exit(0);
}

runMigrations();
