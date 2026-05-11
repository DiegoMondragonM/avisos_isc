// worker/mooc.worker.js
// Punto de entrada del worker.
// Modos de uso:
//   - Producción (PM2):  pm2 start worker/mooc.worker.js --name mooc-worker
//   - Manual una vez:    npm run worker
//   - Cron cada 60 min: se activa automáticamente al levantar con PM2

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cron              = require('node-cron');
const { ejecutarSync }  = require('./mooc.job');
const { pool }          = require('../src/db/pool');

const RUN_ONCE = process.argv.includes('--once');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');

function printHelp() {
  console.log(`
Uso:
  npm run worker           Ejecuta una sincronización y termina
  npm run worker:scheduler Ejecuta al arrancar y luego cada hora
  node worker/mooc.worker.js --once
`);
}

async function main() {
  if (SHOW_HELP) {
    printHelp();
    return;
  }

  console.log('🚀 Worker MOOC arrancando...');

  if (RUN_ONCE) {
    // Modo manual: ejecuta una sola vez y termina
    console.log('📌 Modo: ejecución única (--once)');
    await ejecutarSync();
    await pool.end();
    process.exit(0);
  }

  // Modo scheduler: ejecutar al arrancar + cada 60 minutos
  console.log('📌 Modo: scheduler (cada 60 minutos)');

  // Ejecutar inmediatamente al arrancar
  await ejecutarSync();

  // Luego cada 60 minutos: "0 * * * *" = al minuto 0 de cada hora
  cron.schedule('0 * * * *', async () => {
    console.log('\n⏰ Cron disparado:', new Date().toISOString());
    await ejecutarSync();
  });

  console.log('✅ Scheduler activo. Próxima ejecución: en 60 min');
}

// Manejo de cierre limpio
process.on('SIGINT',  async () => { await pool.end(); process.exit(0); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });

if (require.main === module) {
  main().catch(async (err) => {
    console.error('❌ Error fatal en worker:', err.message);
    await pool.end();
    process.exit(1);
  });
}

module.exports = { main };
