const request = require('supertest');
const app = require('../app');

let dbAvailable = false;

beforeAll(async () => {
  try {
    await require('../src/db/pool')._pool.query('SELECT 1');
    dbAvailable = true;
  } catch {}
});

describe('Assets API', () => {
  it('GET /api/assets should return array', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
