const router  = require('express').Router();
const db      = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

// Helper — generate slug from title
function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

// ── GET /api/blog — public list of published posts
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, title, slug, category, summary, author, author_role,
             read_time, featured, published_at, created_at
      FROM blog_posts
      WHERE published = 1
      ORDER BY featured DESC, published_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch posts' });
  }
});

// ── GET /api/blog/all — admin view (all posts including drafts)
router.get('/all',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT id, title, slug, category, summary, author, author_role,
               read_time, featured, published, published_at, created_at, updated_at
        FROM blog_posts
        ORDER BY created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch posts' });
    }
  }
);

// ── GET /api/blog/:slug — single post (public if published)
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM blog_posts WHERE slug = ?',
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = rows[0];
    if (!post.published) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch post' });
  }
});

// ── POST /api/blog — create new post (admin only)
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { title, category, summary, body, author, author_role, read_time, featured, published } = req.body;
    if (!title || !summary || !body || !author) {
      return res.status(400).json({ error: 'title, summary, body and author are required' });
    }
    try {
      let slug = slugify(title);
      // Ensure unique slug
      const [existing] = await db.execute('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
      if (existing.length > 0) slug = slug + '-' + Date.now();

      const publishedAt = published ? new Date() : null;
      const [result] = await db.execute(`
        INSERT INTO blog_posts
          (title, slug, category, summary, body, author, author_role, read_time, featured, published, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title, slug, category || 'General', summary, body,
        author, author_role || null, read_time || '5 min',
        featured ? 1 : 0, published ? 1 : 0, publishedAt
      ]);

      res.status(201).json({ success: true, id: result.insertId, slug });
    } catch (err) {
      res.status(500).json({ error: 'Could not create post: ' + err.message });
    }
  }
);

// ── PUT /api/blog/:id — update post (admin only)
router.put('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { title, category, summary, body, author, author_role, read_time, featured, published } = req.body;
    try {
      const [rows] = await db.execute('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
      const existing = rows[0];

      // If publishing for first time, set published_at
      let publishedAt = existing.published_at;
      if (published && !existing.published) publishedAt = new Date();

      await db.execute(`
        UPDATE blog_posts SET
          title       = ?,
          category    = ?,
          summary     = ?,
          body        = ?,
          author      = ?,
          author_role = ?,
          read_time   = ?,
          featured    = ?,
          published   = ?,
          published_at = ?
        WHERE id = ?
      `, [
        title       || existing.title,
        category    || existing.category,
        summary     || existing.summary,
        body        || existing.body,
        author      || existing.author,
        author_role || existing.author_role,
        read_time   || existing.read_time,
        featured !== undefined ? (featured ? 1 : 0) : existing.featured,
        published !== undefined ? (published ? 1 : 0) : existing.published,
        publishedAt,
        req.params.id
      ]);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not update post: ' + err.message });
    }
  }
);

// ── DELETE /api/blog/:id — delete post (admin only)
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      await db.execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not delete post' });
    }
  }
);

module.exports = router;
