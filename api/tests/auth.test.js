const request = require('supertest');
const app = require('../app');

// NOTE: registration route is POST /api/auth/signup (not /register)

let dbAvailable = false;

beforeAll(async () => {
  try {
    await require('../src/db/pool')._pool.query('SELECT 1');
    dbAvailable = true;
  } catch {}
});

describe('Auth API', () => {
  it('POST /api/auth/login with bad credentials should return 401', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fake@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/signup with missing fields should return 400', async () => {
    // Validation happens before any DB call — runs without a live database
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com' }); // missing full_name and password
    expect(res.status).toBe(400);
  });
});
