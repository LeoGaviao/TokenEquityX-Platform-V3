require('dotenv').config();

afterAll(async () => {
  const pool = require('../src/db/pool');
  await pool.end();
});
