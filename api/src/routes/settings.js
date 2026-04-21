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
  const { auditor_email, auditor_name, notes } = req.body;
  if (!auditor_email) return res.status(400).json({ error: 'auditor_email is required' });

  try {
    // Get compliance fee from settings
    const [settingsRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'compliance_fee_usd'"
    );
    const complianceFee = parseFloat(settingsRows[0]?.value || 1500);

    // Get submission details
    const [subRows] = await db.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [req.params.id]
    );
    if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = subRows[0];

    // Fetch bank payment details from settings
    const [bankRows] = await db.execute(
      "SELECT key, value FROM platform_settings WHERE key IN ('bank_name','bank_account_name','bank_account_number','bank_branch','bank_swift_code','bank_reference_prefix')"
    );
    const bankSettings = {};
    bankRows.forEach(r => { bankSettings[r.key] = r.value; });
    const paymentRef = `${bankSettings.bank_reference_prefix || 'TEXZ-APP'}-${sub.reference_number?.substring(0,8).toUpperCase() || sub.id}`;

    // Update submission status
    await db.execute(
      `UPDATE data_submissions SET
         application_status = 'APPROVED',
         fee_status = 'PENDING_PAYMENT',
         admin_notes = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [notes || null, req.params.id]
    );

    // Create application fee record
    await db.execute(
      `INSERT INTO application_fees
         (submission_id, token_symbol, issuer_wallet, compliance_fee_usd, auditor_fee_usd, total_fee_usd, status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, NOW())`,
      [req.params.id, sub.token_symbol, sub.issuer_wallet, complianceFee, 0, complianceFee, req.user.userId]
    );

    // Update submission with assigned auditor
    await db.execute(
      `UPDATE data_submissions SET assigned_auditor = ?, updated_at = NOW() WHERE id = ?`,
      [auditor_email, req.params.id]
    );

    // Get issuer details
    const [userRows] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [sub.issuer_wallet]
    );
    const issuer = userRows[0] || {};

    // Send approval email with fee invoice
    if (issuer.email) {
      await mailer.notifyIssuerApplicationApproved({
        issuerEmail:     issuer.email,
        issuerName:      issuer.full_name || 'Issuer',
        tokenSymbol:     sub.token_symbol,
        entityName:      sub.entity_name || sub.token_symbol,
        referenceNumber: sub.reference_number || sub.id,
        complianceFee,
        auditorFee:      0,
        totalFee:        complianceFee,
        auditorName:     auditor_name || auditor_email,
        auditorEmail:    auditor_email,
        paymentRef,
        bankName:        bankSettings.bank_name || 'Stanbic Bank Zimbabwe',
        bankAccountName: bankSettings.bank_account_name || 'TokenEquityX Ltd',
        bankAccountNo:   bankSettings.bank_account_number || 'TBC',
        bankBranch:      bankSettings.bank_branch || 'Harare Main Branch',
        bankSwift:       bankSettings.bank_swift_code || 'SBICZWHX',
      }).catch(err => console.error('Email failed:', err.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `✅ Application Approved — ${sub.entity_name || sub.token_symbol}`,
      body:        `Your tokenisation application has been approved at our Applications Appraisal Meeting.\n\nCOMPLIANCE FEE PAYMENT\nPlease pay the TokenEquityX compliance fee of $${complianceFee.toFixed(2)} USD via bank transfer:\nBank: ${bankSettings.bank_name || 'Stanbic Bank Zimbabwe'}\nAccount Name: ${bankSettings.bank_account_name || 'TokenEquityX Ltd'}\nAccount Number: ${bankSettings.bank_account_number || 'TBC'}\nBranch: ${bankSettings.bank_branch || 'Harare Main Branch'}\nSwift: ${bankSettings.bank_swift_code || 'SBICZWHX'}\nPayment Reference: ${paymentRef}\n\nNOMINATED AUDITOR\nYour nominated auditor is ${auditor_name || auditor_email} (${auditor_email}). Please contact them directly to agree the scope and fee for the audit. The auditor has been notified and will be in touch.\n\nOnce your compliance fee payment is confirmed, the review process will formally commence.`,
      type:        'SYSTEM',
      category:    'APPLICATION',
      referenceId: String(req.params.id),
    }).catch(() => {});

    // Notify auditor of assignment
    const [auditorRows] = await db.execute(
      'SELECT id, full_name, email FROM users WHERE email = ?', [auditor_email]
    );
    if (auditorRows.length > 0) {
      await sendMessage({
        recipientId: auditorRows[0].id,
        subject:     `🔍 New Audit Assignment — ${sub.token_symbol}`,
        body:        `You have been nominated as the auditor for ${sub.entity_name || sub.token_symbol} (${sub.token_symbol}).\n\nThe issuer has been notified and will contact you directly to agree the audit scope and fee. Once agreed, please proceed with the review and submit your findings through the auditor dashboard.\n\nReference: ${sub.reference_number || sub.id}\nIssuer contact will reach out to you at: ${issuer.email || 'via platform'}`,
        type:        'SYSTEM',
        category:    'APPLICATION',
        referenceId: String(req.params.id),
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: `Application approved. Fee invoice sent to issuer. ${auditor_name || auditor_email} notified as nominated auditor.`,
      complianceFee,
      paymentRef,
      auditorEmail: auditor_email,
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
