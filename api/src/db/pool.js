// api/src/db/pool.js
// PostgreSQL connection pool using the 'pg' driver
// Supports both DATABASE_URL (Render auto-sets this) and individual DB_ variables

const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '5432'),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

console.log('[DB] Connecting using:', process.env.DATABASE_URL ? 'DATABASE_URL' : `host=${process.env.DB_HOST} db=${process.env.DB_NAME}`);

const pool = new Pool(poolConfig);

function convertMysqlPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const compatPool = {
  execute: async (sql, params = []) => {
    const pgSql = convertMysqlPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return [result.rows, result.fields];
  },
  query: async (sql, params = []) => {
    const pgSql = convertMysqlPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return [result.rows, result.fields];
  },
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
  _pool: pool,
};

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