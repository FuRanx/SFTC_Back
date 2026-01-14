const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración compatible con Railway y desarrollo local
// Railway proporciona: MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
// Desarrollo local usa: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASS,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || 3306, 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión a la base de datos establecida correctamente');
    console.log('📊 Base de datos:', process.env.MYSQLDATABASE || process.env.DB_NAME);
    connection.release();
  })
  .catch(error => {
    console.error('❌ Error al conectar con la base de datos:', error.message);
  });

module.exports = pool;
