require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./src/db/pool');

const PORT = process.env.PORT || 3000;

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

start();
