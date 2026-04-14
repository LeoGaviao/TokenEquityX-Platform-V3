const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,          // ← added port
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'tokenequityx_v2',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  dateStrings:        true
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected to MySQL');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message);
    console.error('⚠️  API running without database — retrying on next request');
    // Do not exit — let the app stay running and retry connections
  }
}

testConnection();

module.exports = pool;