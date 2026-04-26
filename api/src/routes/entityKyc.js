const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { sendMessage }  = require('../utils/messenger');

// GET /api/entity-kyc/my — get current issuer's entity KYC
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM entity_kyc WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.userId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entity-kyc/submit — issuer submits entity KYC
router.post('/submit', authenticate, requireRole('ISSUER','ADMIN'), async (req, res) => {
  const {
    entity_name, registration_number, registration_country,
    registered_address, business_description, business_type,
    date_incorporated, tax_clearance_number, source_of_funds,
    pep_declaration, sanctions_declaration, aml_declaration,
    beneficial_owners, directors, documents,
  } = req.body;

  if (!entity_name || !registration_number) {
    return res.status(400).json({ error: 'entity_name and registration_number are required' });
  }

  try {
    const [existing] = await db.execute(
      "SELECT id, status FROM entity_kyc WHERE user_id = ? AND status NOT IN ('REJECTED')",
      [req.user.userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: `Entity KYC already submitted. Current status: ${existing[0].status}`,
        kycId: existing[0].id,
      });
    }

    const [result] = await db.execute(`
      INSERT INTO entity_kyc
        (user_id, entity_name, registration_number, registration_country,
         registered_address, business_description, business_type,
         date_incorporated, tax_clearance_number, source_of_funds,
         pep_declaration, sanctions_declaration, aml_declaration,
         beneficial_owners, directors, documents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      RETURNING id
    `, [
      req.user.userId, entity_name, registration_number,
      registration_country || 'Zimbabwe',
      registered_address || null, business_description || null,
      business_type || null, date_incorporated || null,
      tax_clearance_number || null, source_of_funds || null,
      pep_declaration === true || pep_declaration === 'true',
      sanctions_declaration === true || sanctions_declaration === 'true',
      aml_declaration === true || aml_declaration === 'true',
      JSON.stringify(beneficial_owners || []),
      JSON.stringify(directors || []),
      JSON.stringify(documents || []),
    ]);

    const kycId = result[0].id;

    await sendMessage({
      recipientId: req.user.userId,
      subject:     '📋 Entity KYC Submitted',
      body:        `Your Entity KYC & AML application for ${entity_name} has been received.\n\nWhat happens next:\n1. Our compliance team will review your submission within 3-5 business days\n2. You may be contacted for additional information\n3. Once approved, you can proceed with your tokenisation application\n4. If rejected, you will receive detailed feedback and may resubmit\n\nKYC Reference: ${kycId}`,
      type:        'SYSTEM',
      category:    'KYC',
      referenceId: kycId,
    }).catch(() => {});

    const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `🆕 Entity KYC Submitted — ${entity_name}`,
        body:        `A new Entity KYC application has been submitted.\n\nEntity: ${entity_name}\nRegistration: ${registration_number}\nCountry: ${registration_country || 'Zimbabwe'}\nBusiness Type: ${business_type || 'N/A'}\n\nPlease review via the KYC tab in the admin dashboard.\n\nKYC Reference: ${kycId}`,
        type:        'SYSTEM',
        category:    'KYC',
        referenceId: kycId,
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Entity KYC submitted successfully. You will be notified once reviewed.',
      kycId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity-kyc — admin gets all entity KYC submissions
router.get('/', authenticate, requireRole('ADMIN','COMPLIANCE_OFFICER'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT e.*, u.email, u.full_name
      FROM entity_kyc e
      JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/entity-kyc/:id/approve — admin approves entity KYC
router.put('/:id/approve', authenticate, requireRole('ADMIN','COMPLIANCE_OFFICER'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM entity_kyc WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'KYC record not found' });
    const kyc = rows[0];

    await db.execute(
      "UPDATE entity_kyc SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
      [req.user.userId, req.params.id]
    );

    await sendMessage({
      recipientId: kyc.user_id,
      subject:     `✅ Entity KYC Approved — ${kyc.entity_name}`,
      body:        `Congratulations! Your Entity KYC & AML verification for ${kyc.entity_name} has been approved.\n\nYou can now proceed with your tokenisation application. Please go to the Tokenisation Application section of your dashboard to begin.\n\nKYC Reference: ${kyc.id}`,
      type:        'SYSTEM',
      category:    'KYC',
      referenceId: kyc.id,
    }).catch(() => {});

    res.json({ success: true, message: `Entity KYC approved for ${kyc.entity_name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/entity-kyc/:id/reject — admin rejects entity KYC
router.put('/:id/reject', authenticate, requireRole('ADMIN','COMPLIANCE_OFFICER'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
  try {
    const [rows] = await db.execute('SELECT * FROM entity_kyc WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'KYC record not found' });
    const kyc = rows[0];

    await db.execute(
      "UPDATE entity_kyc SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
      [reason, req.user.userId, req.params.id]
    );

    await sendMessage({
      recipientId: kyc.user_id,
      subject:     `❌ Entity KYC Rejected — ${kyc.entity_name}`,
      body:        `Your Entity KYC & AML submission for ${kyc.entity_name} has not been approved at this time.\n\nReason: ${reason}\n\nYou may resubmit after addressing the issues raised. Please contact compliance@tokenequityx.co.zw if you have questions.\n\nKYC Reference: ${kyc.id}`,
      type:        'SYSTEM',
      category:    'KYC',
      referenceId: kyc.id,
    }).catch(() => {});

    res.json({ success: true, message: 'KYC rejected. Issuer has been notified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
