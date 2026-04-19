// api/src/routes/settings.js
// Platform settings and application fee workflow

const router  = require('express').Router();
const db      = require('../db/pool');
const mailer  = require('../utils/mailer');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { sendMessage }  = require('../utils/messenger');

// ── GET /api/settings — get all platform settings
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM platform_settings ORDER BY key');
    const settings = {};
    rows.forEach(r => { settings[r.key] = { value: r.value, description: r.description, updated_at: r.updated_at }; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch settings: ' + err.message });
  }
});

// ── PUT /api/settings/:key — update a platform setting
router.put('/:key', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: 'value is required' });
  try {
    await db.execute(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [req.params.key, value, req.user.userId]
    );
    res.json({ success: true, key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: 'Could not update setting: ' + err.message });
  }
});

// ── POST /api/settings/applications/:id/approve
// Admin approves application at Tuesday meeting, sets auditor fee, sends fee invoice email
router.post('/applications/:id/approve', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { auditor_fee_usd, notes } = req.body;
  if (!auditor_fee_usd) return res.status(400).json({ error: 'auditor_fee_usd is required' });

  try {
    // Get compliance fee from settings
    const [settingsRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'compliance_fee_usd'"
    );
    const complianceFee = parseFloat(settingsRows[0]?.value || 1500);
    const auditorFee    = parseFloat(auditor_fee_usd);
    const totalFee      = complianceFee + auditorFee;

    // Get submission details
    const [subRows] = await db.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [req.params.id]
    );
    if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = subRows[0];

    // Update submission status
    await db.execute(
      `UPDATE data_submissions SET
         application_status = 'APPROVED',
         auditor_fee_usd = ?,
         fee_status = 'PENDING_PAYMENT',
         admin_notes = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [auditorFee, notes || null, req.params.id]
    );

    // Create application fee record
    await db.execute(
      `INSERT INTO application_fees
         (submission_id, token_symbol, issuer_wallet, compliance_fee_usd, auditor_fee_usd, total_fee_usd, status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, NOW())`,
      [req.params.id, sub.token_symbol, sub.issuer_wallet, complianceFee, auditorFee, totalFee, req.user.userId]
    );

    // Get issuer details
    const [userRows] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [sub.issuer_wallet]
    );
    const issuer = userRows[0] || {};

    // Send approval email with fee invoice
    if (issuer.email) {
      await mailer.notifyIssuerApplicationApproved({
        issuerEmail:    issuer.email,
        issuerName:     issuer.full_name || 'Issuer',
        tokenSymbol:    sub.token_symbol,
        entityName:     sub.entity_name || sub.token_symbol,
        referenceNumber: sub.reference_number || sub.id,
        complianceFee,
        auditorFee,
        totalFee,
      }).catch(err => console.error('Email failed:', err.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `✅ Application Approved — Fee Invoice`,
      body:        `Your application for ${sub.entity_name || sub.token_symbol} has been approved. Please deposit the application fee of $${totalFee.toFixed(2)} USD to your platform wallet. Compliance fee: $${complianceFee.toFixed(2)}, Auditor fee: $${auditorFee.toFixed(2)}. Reference: ${sub.reference_number || sub.id}`,
      type:        'SYSTEM',
      category:    'APPLICATION',
      referenceId: String(req.params.id),
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Application approved. Fee invoice sent to issuer.',
      complianceFee,
      auditorFee,
      totalFee,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not approve application: ' + err.message });
  }
});

// ── POST /api/settings/applications/:id/reject
// Admin rejects application, sends rejection email
router.post('/applications/:id/reject', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  try {
    const [subRows] = await db.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [req.params.id]
    );
    if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = subRows[0];

    await db.execute(
      `UPDATE data_submissions SET
         application_status = 'REJECTED',
         rejection_reason = ?,
         status = 'REJECTED',
         fee_status = 'NOT_REQUIRED',
         updated_at = NOW()
       WHERE id = ?`,
      [reason, req.params.id]
    );

    const [userRows] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [sub.issuer_wallet]
    );
    const issuer = userRows[0] || {};

    if (issuer.email) {
      await mailer.notifyIssuerApplicationRejected({
        issuerEmail:     issuer.email,
        issuerName:      issuer.full_name || 'Issuer',
        tokenSymbol:     sub.token_symbol,
        entityName:      sub.entity_name || sub.token_symbol,
        referenceNumber: sub.reference_number || sub.id,
        reason,
      }).catch(err => console.error('Email failed:', err.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `❌ Application Not Approved`,
      body:        `Your application for ${sub.entity_name || sub.token_symbol} was not approved at this time. Reason: ${reason}. You may resubmit after addressing the concerns raised.`,
      type:        'SYSTEM',
      category:    'APPLICATION',
      referenceId: String(req.params.id),
    }).catch(() => {});

    res.json({ success: true, message: 'Application rejected. Issuer notified by email.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not reject application: ' + err.message });
  }
});

// ── POST /api/settings/applications/:id/confirm-fee
// Admin confirms fee received, assigns auditor, sends confirmation email
router.post('/applications/:id/confirm-fee', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { auditor_email, auditor_name, estimated_days } = req.body;
  if (!auditor_email) return res.status(400).json({ error: 'auditor_email is required' });

  try {
    const [subRows] = await db.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [req.params.id]
    );
    if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = subRows[0];

    await db.execute(
      `UPDATE data_submissions SET
         application_status = 'FEE_CONFIRMED',
         fee_status = 'PAID',
         status = 'UNDER_REVIEW',
         assigned_auditor = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [auditor_email, req.params.id]
    );

    await db.execute(
      `UPDATE application_fees SET
         status = 'PAID',
         auditor_assigned = ?,
         fee_confirmed_by = ?,
         fee_confirmed_at = NOW()
       WHERE submission_id = ?`,
      [auditor_email, req.user.userId, req.params.id]
    );

    const [userRows] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [sub.issuer_wallet]
    );
    const issuer = userRows[0] || {};

    if (issuer.email) {
      await mailer.notifyIssuerFeeReceivedAuditorAssigned({
        issuerEmail:     issuer.email,
        issuerName:      issuer.full_name || 'Issuer',
        tokenSymbol:     sub.token_symbol,
        entityName:      sub.entity_name || sub.token_symbol,
        referenceNumber: sub.reference_number || sub.id,
        auditorName:     auditor_name || auditor_email,
        estimatedDays:   estimated_days || 10,
      }).catch(err => console.error('Email failed:', err.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `🔍 Audit Commencing — ${sub.token_symbol}`,
      body:        `Your application fee has been received and confirmed. ${auditor_name || auditor_email} has been assigned as your auditor. The review is expected to take approximately ${estimated_days || 10} business days.`,
      type:        'SYSTEM',
      category:    'APPLICATION',
      referenceId: String(req.params.id),
    }).catch(() => {});

    res.json({ success: true, message: 'Fee confirmed. Auditor assigned. Issuer notified.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not confirm fee: ' + err.message });
  }
});

// ── GET /api/settings/applications — list all applications with fee status
router.get('/applications', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT ds.id, ds.token_symbol, ds.entity_name, ds.status,
             ds.application_status, ds.fee_status, ds.auditor_fee_usd,
             ds.assigned_auditor, ds.created_at, ds.reference_number,
             af.compliance_fee_usd, af.total_fee_usd, af.auditor_assigned
      FROM data_submissions ds
      LEFT JOIN application_fees af ON af.submission_id = ds.id
      ORDER BY ds.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch applications: ' + err.message });
  }
});

module.exports = router;
