// api/src/utils/messenger.js
// Intra-platform messaging helper — writes messages to the DB messages table only.
// External email notifications are sent explicitly via named functions in mailer.js
// from each route handler. This separation ensures every email has a purpose-built
// template and avoids accidental double-sends.

const db = require('../db/pool');

/**
 * Send an internal platform message to a user.
 * @param {object} opts
 * @param {string} opts.recipientId  - UUID of recipient user
 * @param {string} opts.subject      - Message subject
 * @param {string} opts.body         - Message body (plain text)
 * @param {string} opts.type         - 'SYSTEM' or 'DIRECT'
 * @param {string} opts.category     - e.g. 'APPLICATION', 'TRADING', 'WALLET', 'KYC', 'DIVIDEND'
 * @param {string} opts.referenceId  - Optional reference (submission ID, trade ID etc.)
 * @param {string} opts.senderId     - Optional sender UUID (null for system messages)
 */
async function sendMessage(opts) {
  const {
    recipientId, subject, body, type = 'SYSTEM', category = 'GENERAL',
    referenceId = null, senderId = '00000000-0000-0000-0000-000000000001',
  } = opts;

  try {
    await db.execute(
      `INSERT INTO messages (sender_id, recipient_id, subject, body, type, category, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [senderId, recipientId, subject, body, type, category, referenceId]
    );
  } catch (err) {
    console.error('[MESSENGER] Failed to save message:', err.message);
  }
}

/**
 * Send a system message to multiple recipients
 */
async function broadcastMessage(recipientIds, subject, body, category = 'GENERAL') {
  for (const recipientId of recipientIds) {
    await sendMessage({ recipientId, subject, body, category });
  }
}

/**
 * Get unread message count for a user
 */
async function getUnreadCount(userId) {
  try {
    const [[row]] = await db.execute(
      'SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND is_read = FALSE AND is_deleted = FALSE',
      [userId]
    );
    return parseInt(row.count) || 0;
  } catch {
    return 0;
  }
}

module.exports = { sendMessage, broadcastMessage, getUnreadCount };
