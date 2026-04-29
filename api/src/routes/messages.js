// api/src/routes/messages.js
const router    = require('express').Router();
const db        = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { sendMessage }  = require('../utils/messenger');

// GET /api/messages — inbox
router.get('/', authenticate, async (req, res) => {
  try {
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const [rows] = await db.execute(`
      SELECT m.id, m.subject, m.body, m.type, m.category,
             m.is_read, m.created_at, m.reference_id,
             u.full_name as sender_name, u.email as sender_email
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.recipient_id = ? AND (m.is_deleted = FALSE OR m.is_deleted IS NULL)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.userId, limit, offset]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch messages: ' + err.message });
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const [[row]] = await db.execute(
      'SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND (is_read = FALSE OR is_read IS NULL) AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [req.user.userId]
    );
    res.json({ count: parseInt(row.count) || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch count: ' + err.message });
  }
});

// GET /api/messages/sent
router.get('/sent', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT m.id, m.subject, m.body, m.type, m.category,
             m.is_read, m.created_at, m.reference_id,
             u.full_name as recipient_name, u.email as recipient_email
      FROM messages m
      LEFT JOIN users u ON u.id = m.recipient_id
      WHERE m.sender_id = ? AND m.is_deleted = FALSE
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch sent messages: ' + err.message });
  }
});

// PUT /api/messages/:id/read — mark as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.execute(
      'UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not mark as read: ' + err.message });
  }
});

// PUT /api/messages/read-all — mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.execute(
      'UPDATE messages SET is_read = TRUE WHERE recipient_id = ? AND is_read = FALSE',
      [req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not mark all as read: ' + err.message });
  }
});

// DELETE /api/messages/:id — soft delete
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.execute(
      'UPDATE messages SET is_deleted = TRUE WHERE id = ? AND recipient_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete message: ' + err.message });
  }
});

// POST /api/messages — send a direct message (user to user)
router.post('/', authenticate, async (req, res) => {
  const { recipientId, subject, body } = req.body;
  if (!recipientId || !subject || !body) {
    return res.status(400).json({ error: 'recipientId, subject and body are required' });
  }
  try {
    const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [recipientId]);
    if (users.length === 0) return res.status(404).json({ error: 'Recipient not found' });
    await sendMessage({
      senderId:    req.user.userId,
      recipientId,
      subject,
      body,
      type:        'DIRECT',
      category:    'DIRECT',
    });
    res.json({ success: true, message: 'Message sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not send message: ' + err.message });
  }
});

module.exports = router;
