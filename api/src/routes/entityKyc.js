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
      subject:     `📋 Entity KYC Submitted — ${entity_name}`,
      body:        `Your Entity KYC & AML application for ${entity_name} has been received.\n\nWhat happens next:\n1. Our compliance team will review your submission within 3-5 business days\n2. You may be contacted for additional information\n3. Once approved, you can proceed with your tokenisation application\n4. If rejected, you will receive detailed feedback and may resubmit\n\nKYC Reference: ${kycId}`,
      type:        'SYSTEM',
      category:    'KYC',
      referenceId: String(kycId),
    }).catch(e => console.error('[MESSENGER] entity-kyc/submit sendMessage (issuer) failed:', e.message));

    const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `🆕 Entity KYC Submitted — ${entity_name}`,
        body:        `A new Entity KYC application has been submitted.\n\nEntity: ${entity_name}\nRegistration: ${registration_number}\nCountry: ${registration_country || 'Zimbabwe'}\nBusiness Type: ${business_type || 'N/A'}\n\nPlease review via the KYC tab in the admin dashboard.\n\nKYC Reference: ${kycId}`,
        type:        'SYSTEM',
        category:    'KYC',
        referenceId: kycId,
      }).catch(e => console.error('[MESSENGER] entity-kyc/submit sendMessage (admin) failed:', e.message));
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
    }).catch(e => console.error('[MESSENGER] entity-kyc/approve sendMessage (issuer) failed:', e.message));

    // FIX 2.4 — send external email confirming KYC approval
    try {
      const { notifyIssuerEntityKycApproved } = require('../utils/mailer');
      const [kycApproveRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [kyc.user_id]);
      if (kycApproveRows[0]?.email) {
        notifyIssuerEntityKycApproved({
          issuerEmail:        kycApproveRows[0].email,
          issuerName:         kycApproveRows[0].full_name,
          entityName:         kyc.entity_name,
          registrationNumber: kyc.registration_number,
          approvalDate:       new Date(),
        }).catch(e => console.error('[MAILER] entity-kyc/approve notifyIssuerEntityKycApproved failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[ENTITY-KYC-APPROVE] Notification error (non-fatal):', notifyErr.message);
    }

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
    }).catch(e => console.error('[MESSENGER] entity-kyc/reject sendMessage (issuer) failed:', e.message));

    // FIX 2.5 — send external email confirming KYC rejection with reason
    try {
      const { notifyIssuerEntityKycRejected } = require('../utils/mailer');
      const [kycRejectRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [kyc.user_id]);
      if (kycRejectRows[0]?.email) {
        notifyIssuerEntityKycRejected({
          issuerEmail: kycRejectRows[0].email,
          issuerName:  kycRejectRows[0].full_name,
          entityName:  kyc.entity_name,
          reason,
        }).catch(e => console.error('[MAILER] entity-kyc/reject notifyIssuerEntityKycRejected failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[ENTITY-KYC-REJECT] Notification error (non-fatal):', notifyErr.message);
    }

    res.json({ success: true, message: 'KYC rejected. Issuer has been notified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entity-kyc/upload-bo-doc — upload a beneficial owner ID document
// FormData fields: file (required), owner_index (optional int)
// If owner_index is supplied and an entity_kyc record already exists for this user,
// the uploaded URL is written back into beneficial_owners[owner_index].kyc_doc_url.
// When no record exists yet (first-time flow) the URL is returned and the frontend
// includes it in the full beneficial_owners array on POST /submit.
router.post('/upload-bo-doc', authenticate, requireRole('ISSUER','ADMIN'), async (req, res) => {
  try {
    const upload = require('../middleware/upload');
    const uploadMiddleware = upload.single('file');
    uploadMiddleware(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { uploadToSupabase } = require('../middleware/upload');
      const result = await uploadToSupabase(req.file, 'entity-kyc', req.user.userId);

      // Attempt writeback if an existing KYC record is present
      const ownerIndex = req.body.owner_index !== undefined ? parseInt(req.body.owner_index, 10) : null;
      try {
        const [rows] = await db.execute(
          "SELECT id, beneficial_owners FROM entity_kyc WHERE user_id = ? AND status NOT IN ('REJECTED') ORDER BY created_at DESC LIMIT 1",
          [req.user.userId]
        );
        if (rows.length > 0 && ownerIndex !== null && !isNaN(ownerIndex)) {
          const kycRow = rows[0];
          const owners = typeof kycRow.beneficial_owners === 'string'
            ? JSON.parse(kycRow.beneficial_owners)
            : (kycRow.beneficial_owners || []);
          if (Array.isArray(owners) && owners[ownerIndex] !== undefined) {
            owners[ownerIndex] = {
              ...owners[ownerIndex],
              kyc_doc_url:  result.url,
              kyc_doc_path: result.path,
              kyc_doc_name: result.name,
            };
            await db.execute(
              'UPDATE entity_kyc SET beneficial_owners = ?, updated_at = NOW() WHERE id = ?',
              [JSON.stringify(owners), kycRow.id]
            );
          }
        }
      } catch (_writebackErr) {
        // Writeback failure must never block the upload response
      }

      res.json({ success: true, url: result.url, path: result.path, name: result.name });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
