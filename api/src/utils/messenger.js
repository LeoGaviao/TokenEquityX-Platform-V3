// api/src/utils/messenger.js
// Intra-platform messaging helper
// Sends internal messages to users AND optionally triggers an external email notification

const db     = require('../db/pool');
const mailer = require('./mailer');

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://tokenequityx.co.zw';

/**
 * Send an internal platform message to a user
 * @param {object} opts
 * @param {string} opts.recipientId  - UUID of recipient user
 * @param {string} opts.subject      - Message subject
 * @param {string} opts.body         - Message body (plain text or HTML)
 * @param {string} opts.type         - 'SYSTEM' or 'DIRECT'
 * @param {string} opts.category     - e.g. 'APPLICATION', 'TRADING', 'WALLET', 'KYC', 'DIVIDEND'
 * @param {string} opts.referenceId  - Optional reference (submission ID, trade ID etc.)
 * @param {string} opts.senderId     - Optional sender UUID (null for system messages)
 * @param {boolean} opts.sendEmail   - Whether to also send external email notification
 * @param {string} opts.recipientEmail - Required if sendEmail is true
 * @param {string} opts.recipientName  - Optional, used in email
 */
async function sendMessage(opts) {
  const {
    recipientId, subject, body, type = 'SYSTEM', category = 'GENERAL',
    referenceId = null, senderId = null, sendEmail = false,
    recipientEmail, recipientName
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

  // Send external email notification if requested
  if (sendEmail && recipientEmail) {
    try {
      const mailer = require('./mailer');
      await mailer.send(
        recipientEmail,
        `[TokenEquityX] ${subject}`,
        `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f4f4f5; margin:0; padding:20px; }
  .card { background:#ffffff; border-radius:12px; max-width:600px; margin:0 auto; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
  .header { background:#1A3C5E; padding:28px 32px; }
  .header h1 { color:#C8972B; font-size:22px; margin:0; font-weight:800; }
  .body { padding:28px 32px; }
  .body p { color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px; }
  .btn { display:inline-block; background:#C8972B; color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:700; font-size:14px; margin-top:20px; }
  .footer { background:#f9fafb; padding:16px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
</style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>TokenEquityX</h1></div>
    <div class="body">
      <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">${subject}</h2>
      <p>Dear ${recipientName || 'User'},</p>
      <p>You have a new message in your TokenEquityX inbox.</p>
      <p style="background:#f3f4f6;border-radius:8px;padding:12px 16px;font-style:italic;color:#374151;">${body.replace(/<[^>]*>/g, '').substring(0, 300)}${body.length > 300 ? '...' : ''}</p>
      <a href="${PLATFORM_URL}" class="btn">View in Platform →</a>
    </div>
    <div class="footer">TokenEquityX Ltd · Harare, Zimbabwe · tokenequityx.co.zw<br/>This is an automated notification.</div>
  </div>
</body>
</html>`
      );
    } catch (emailErr) {
      console.error('[MESSENGER] Email notification failed:', emailErr.message);
    }
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
