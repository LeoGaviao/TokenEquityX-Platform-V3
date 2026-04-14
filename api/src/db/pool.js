// api/src/db/pool.js
// PostgreSQL connection pool using the 'pg' driver
// Replaces mysql2/promise for Render PostgreSQL compatibility

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Compatibility layer — mysql2 uses execute() and query() with array params
// pg uses query() with $1 $2 placeholders
// We wrap pool to provide a mysql2-compatible interface

function convertMysqlPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const compatPool = {
  // mysql2-style: pool.execute(sql, params) → [rows, fields]
  execute: async (sql, params = []) => {
    const pgSql = convertMysqlPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return [result.rows, result.fields];
  },

  // mysql2-style: pool.query(sql, params) → [rows, fields]
  query: async (sql, params = []) => {
    const pgSql = convertMysqlPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return [result.rows, result.fields];
  },

  // Get a connection for transactions
  getConnection: async () => {
    const client = await pool.connect();
    return {
      execute: async (sql, params = []) => {
        const pgSql = convertMysqlPlaceholders(sql);
        const result = await client.query(pgSql, params);
        return [result.rows, result.fields];
      },
      query: async (sql, params = []) => {
        const pgSql = convertMysqlPlaceholders(sql);
        const result = await client.query(pgSql, params);
        return [result.rows, result.fields];
      },
      beginTransaction: async () => { await client.query('BEGIN'); },
      commit:           async () => { await client.query('COMMIT'); },
      rollback:         async () => { await client.query('ROLLBACK'); },
      release:          ()       => { client.release(); },
    };
  },

  // Raw pg pool access if needed
  _pool: pool,
};

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err.message);
    console.error('⚠️  API running without database — retrying on next request');
  }
}

testConnection();

module.exports = compatPool;
