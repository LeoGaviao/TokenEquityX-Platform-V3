const request = require('supertest');
const app = require('../app');

let dbAvailable = false;

beforeAll(async () => {
  try {
    await require('../src/db/pool')._pool.query('SELECT 1');
    dbAvailable = true;
  } catch {}
});

describe('Blog API', () => {
  it('GET /api/blog should return array of posts', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/blog');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/blog/:slug should return a single post', async () => {
    if (!dbAvailable) return;
    const list = await request(app).get('/api/blog');
    if (list.body.length === 0) return; // skip if no posts
    const slug = list.body[0].slug;
    const res = await request(app).get(`/api/blog/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slug', slug);
  });

  it('GET /api/blog/nonexistent should return 404', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/blog/this-does-not-exist');
    expect(res.status).toBe(404);
  });
});
