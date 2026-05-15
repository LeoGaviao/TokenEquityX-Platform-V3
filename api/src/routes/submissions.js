// api/src/routes/submissions.js
const router  = require('express').Router();
const db      = require('../db/pool');
const logger  = require('../utils/logger');
const upload  = require('../middleware/upload');
const { uploadToSupabase } = require('../middleware/upload');
const { authenticate }            = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { v4: uuidv4 }              = require('uuid');
const path    = require('path');

// ── POST /api/submissions/financial ────────────────────────────
router.post('/financial',
  authenticate,
  requireKYC,
  upload.array('documents', 10),
  async (req, res) => {
    const {
      tokenSymbol, period, revenue, ebitda, netAssets,
      netLiabilities, operationalKpis, managementStatement,
      distributionAnnouncement
    } = req.body;

    if (!tokenSymbol || !period) {
      return res.status(400).json({ error: 'Token symbol and period are required' });
    }

    try {
      const [tokens] = await db.execute(
        `SELECT t.id, t.token_symbol FROM tokens t
         JOIN spvs s ON s.id = t.spv_id
         WHERE (t.symbol = ? OR t.token_symbol = ?)
         AND s.owner_user_id = ?`,
        [tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase(), req.user.userId]
      );

      if (tokens.length === 0 && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'You do not own a token with this symbol' });
      }

      const subId = uuidv4();

      // Upload documents to Supabase Storage
      const uploadedDocs = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToSupabase(file, 'submissions', req.user.userId);
            uploadedDocs.push(uploaded);
          } catch (uploadErr) {
            console.error('Document upload failed:', uploadErr.message);
          }
        }
      }

      const financialData = {
        revenue:                  revenue || null,
        ebitda:                   ebitda || null,
        netAssets:                netAssets || null,
        netLiabilities:           netLiabilities || null,
        operationalKpis:          operationalKpis ? JSON.parse(operationalKpis) : {},
        managementStatement:      managementStatement || null,
        distributionAnnouncement: distributionAnnouncement || null,
      };

      const dataJson = JSON.stringify({
        financialData,
        documents:  uploadedDocs,
        submittedAt: new Date().toISOString(),
      });

      const entityName = tokens.length > 0
        ? (tokens[0].name || tokens[0].token_name || tokenSymbol.toUpperCase())
        : tokenSymbol.toUpperCase();

      await db.execute(`
        INSERT INTO data_submissions
          (token_symbol, entity_name, issuer_wallet, period, submission_type,
           data_json, document_count, status, reference_number)
        VALUES (?, ?, ?, ?, 'FINANCIAL_DATA', ?, ?, 'PENDING', ?)
      `, [
        tokenSymbol.toUpperCase(), entityName, req.user.userId, period,
        dataJson, uploadedDocs.length, subId,
      ]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['FINANCIAL_SUBMISSION', req.user.wallet || req.user.userId, tokenSymbol,
         `Period: ${period}, Files: ${uploadedDocs.length}`]
      );

      logger.info('Financial submission received', {
        submissionId: subId, tokenSymbol, period,
        files: uploadedDocs.length, userId: req.user.userId
      });

      res.json({
        success:           true,
        submissionId:      subId,
        tokenSymbol:       tokenSymbol.toUpperCase(),
        period,
        documentsUploaded: uploadedDocs.length,
        documents:         uploadedDocs.map(d => ({ name: d.name, url: d.url })),
        message:           `Financial data submitted successfully for ${period}. Your auditor will review within 5 business days.`,
      });
    } catch (err) {
      logger.error('Financial submission failed', { error: err.message });
      res.status(500).json({ error: 'Submission failed: ' + err.message });
    }
  }
);

// ── POST /api/submissions/tokenise ─────────────────────────────
router.post('/tokenise',
  authenticate,
  upload.array('documents', 10),
  async (req, res) => {
    const {
      legalEntityName, registrationNumber, proposedSymbol, tokenName,
      assetClass, assetDescription, targetRaiseUsd, tokenIssuePrice,
      totalSupply, expectedYield, distributionFrequency,
      keyPersonnel, jurisdiction,
    } = req.body;

    if (!legalEntityName || !proposedSymbol || !assetClass) {
      return res.status(400).json({ error: 'Legal entity name, proposed symbol, and asset class are required' });
    }

    try {
      const [existing] = await db.execute(
        'SELECT id FROM tokens WHERE token_symbol = ? OR token_symbol = ?',
        [proposedSymbol.toUpperCase(), proposedSymbol.toUpperCase()]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: `Token symbol ${proposedSymbol.toUpperCase()} is already taken` });
      }

      const appId = uuidv4();

      const uploadedDocs = req.files ? req.files.map(f => ({
        originalName: f.originalname,
        storedName:   f.filename,
        url:          `/uploads/assets/${f.filename}`,
        size:         f.size,
        mimetype:     f.mimetype,
      })) : [];

      const dataJson = JSON.stringify({
        type:                  'TOKENISATION_APPLICATION',
        legalEntityName,
        registrationNumber:    registrationNumber || null,
        proposedSymbol:        proposedSymbol.toUpperCase(),
        tokenName,
        assetClass,
        assetDescription,
        jurisdiction:          jurisdiction || 'Zimbabwe',
        targetRaiseUsd:        parseFloat(targetRaiseUsd) || null,
        tokenIssuePrice:       parseFloat(tokenIssuePrice) || 1.00,
        totalSupply:           parseInt(totalSupply) || null,
        expectedYield:         expectedYield || null,
        distributionFrequency: distributionFrequency || null,
        keyPersonnel:          keyPersonnel ? JSON.parse(keyPersonnel) : [],
        documents:             uploadedDocs,
        submittedBy:           req.user.userId,
        submittedAt:           new Date().toISOString(),
        referenceNumber:       `TEX-${new Date().getFullYear()}-${Math.floor(Math.random()*9000)+1000}`,
      });

      await db.execute(`
        INSERT INTO data_submissions
          (id, token_symbol, issuer_wallet, period, data_json, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `, [appId, proposedSymbol.toUpperCase(), req.user.userId, 'TOKENISATION_APPLICATION', dataJson]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['TOKENISATION_APPLICATION', req.user.wallet || req.user.userId,
         proposedSymbol.toUpperCase(), `Entity: ${legalEntityName}, Files: ${uploadedDocs.length}`]
      );

      const parsed = JSON.parse(dataJson);
      logger.info('Tokenisation application received', {
        appId, symbol: proposedSymbol.toUpperCase(), entity: legalEntityName,
        files: uploadedDocs.length, ref: parsed.referenceNumber
      });

      res.json({
        success:           true,
        applicationId:     appId,
        referenceNumber:   parsed.referenceNumber,
        proposedSymbol:    proposedSymbol.toUpperCase(),
        documentsUploaded: uploadedDocs.length,
        documents:         uploadedDocs.map(d => ({ name: d.name, url: d.url })),
        message:           `Tokenisation application submitted. Reference: ${parsed.referenceNumber}. Our compliance team will contact you within 5 business days.`,
      });
    } catch (err) {
      logger.error('Tokenisation application failed', { error: err.message });
      res.status(500).json({ error: 'Application failed: ' + err.message });
    }
  }
);

// ── GET /api/submissions/my ─────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, token_symbol, status, auditor_notes,
             updated_at as reviewed_at, created_at, assigned_auditor,
             reference_number, submission_type, entity_name, document_count
      FROM data_submissions
      WHERE issuer_wallet = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch submissions' });
  }
});

// ── GET /api/submissions/pending ────────────────────────────────
router.get('/pending',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      let rows;
      if (req.user.role === 'ADMIN' || req.user.role === 'COMPLIANCE_OFFICER') {
        [rows] = await db.execute(`
          SELECT ds.id, ds.token_symbol, ds.status,
                 ds.created_at, ds.auditor_notes, ds.updated_at as reviewed_at,
                 ds.issuer_wallet,
                 ds.assigned_auditor, ds.audit_report,
                 ds.admin_notes, ds.entity_name,
                 ds.reference_number, ds.submission_type,
                 ds.data_json, ds.application_status, ds.fee_status,
                 ds.rejection_reason, ds.document_count,
                 ds.auditor_status, ds.auditor_declined_reason,
                 ds.admin_approved_by, ds.admin_approved_at
          FROM data_submissions ds
          WHERE ds.status NOT IN ('REJECTED')
          AND (ds.deleted_at IS NULL OR ds.deleted_at > NOW() - INTERVAL '90 days')
          ORDER BY ds.created_at ASC
        `);
      } else {
        const auditorId     = req.user.userId;
        const auditorWallet = req.user.wallet || '';
        [rows] = await db.execute(`
          SELECT ds.id, ds.token_symbol, ds.status,
                 ds.created_at, ds.auditor_notes, ds.updated_at as reviewed_at,
                 ds.issuer_wallet, ds.assigned_auditor,
                 ds.entity_name, ds.reference_number, ds.submission_type,
                 ds.data_json, ds.application_status, ds.fee_status
          FROM data_submissions ds
          WHERE ds.status NOT IN ('APPROVED', 'REJECTED')
          AND (ds.assigned_auditor = ? OR ds.assigned_auditor = ? OR ds.assigned_auditor LIKE ?)
          ORDER BY ds.created_at ASC
        `, [auditorId, auditorWallet, `%${auditorWallet.slice(0,8)}%`]);
      }
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch submissions: ' + err.message });
    }
  }
);

// ── GET /api/submissions/:id ────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM data_submissions WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = rows[0];
    if (sub.issuer_wallet !== req.user.userId &&
        !['ADMIN','AUDITOR','COMPLIANCE_OFFICER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    sub.data_json = JSON.parse(sub.data_json);
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch submission' });
  }
});

// ── PUT /api/submissions/:id/assign ────────────────────────────
router.put('/:id/assign',
  authenticate,
  requireRole('ADMIN', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { assignedAuditor } = req.body;
    if (!assignedAuditor) {
      return res.status(400).json({ error: 'assignedAuditor is required' });
    }
    try {
      // Resolve auditor identifier to UUID
      // assignedAuditor could be email, UUID, or wallet address
      let auditorUUID = assignedAuditor;
      let auditorEmailResolved = assignedAuditor;

      if (assignedAuditor.includes('@')) {
        const [audRows] = await db.execute(
          "SELECT id, email FROM users WHERE email = ? AND role = 'AUDITOR'",
          [assignedAuditor]
        );
        if (audRows.length > 0) {
          auditorUUID = audRows[0].id;
          auditorEmailResolved = audRows[0].email;
        } else {
          return res.status(404).json({ error: `Auditor with email ${assignedAuditor} not found` });
        }
      } else if (!assignedAuditor.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
        // Not a UUID — try looking up by name or wallet
        const [audRows] = await db.execute(
          "SELECT id, email FROM users WHERE (full_name ILIKE ? OR wallet = ?) AND role = 'AUDITOR'",
          [`%${assignedAuditor}%`, assignedAuditor]
        );
        if (audRows.length > 0) {
          auditorUUID = audRows[0].id;
          auditorEmailResolved = audRows[0].email;
        }
      } else {
        // It's a UUID — look up the email
        const [audRows] = await db.execute(
          "SELECT id, email FROM users WHERE id = ? AND role = 'AUDITOR'",
          [assignedAuditor]
        );
        if (audRows.length > 0) {
          auditorEmailResolved = audRows[0].email;
        }
      }

      await db.execute(`
        UPDATE data_submissions
        SET assigned_auditor = ?, status = 'UNDER_REVIEW',
            auditor_notes = COALESCE(auditor_notes, '') || ' | Assigned to: ' || ?
        WHERE id = ?
      `, [auditorUUID, auditorEmailResolved, req.params.id]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['AUDITOR_ASSIGNED', req.user.wallet || req.user.userId, req.params.id,
         `Assigned to: ${assignedAuditor}`]
      );

      // Get submission details for notifications
      const { sendMessage } = require('../utils/messenger');
      const { notifyAuditorAssigned } = require('../utils/mailer');
      const [subRows] = await db.execute(
        'SELECT token_symbol, issuer_wallet, entity_name, reference_number FROM data_submissions WHERE id = ?',
        [req.params.id]
      );
      const sub = subRows[0] || {};

      // Look up auditor full_name using the resolved UUID (auditorUUID is always a UUID at this point)
      const [auditorDetailRows] = await db.execute(
        'SELECT full_name FROM users WHERE id = ?',
        [auditorUUID]
      );
      const auditorFullName = auditorDetailRows[0]?.full_name;

      // Notify auditor — use auditorUUID for in-platform message, auditorEmailResolved for email
      if (auditorUUID) {
        await sendMessage({
          recipientId: auditorUUID,
          subject:     `🔍 New Assignment — ${sub.token_symbol}`,
          body:        `You have been assigned to review a tokenisation application.\n\nCompany: ${sub.entity_name || sub.token_symbol}\nToken Symbol: ${sub.token_symbol}\nReference: ${sub.reference_number}\n\nPlease log into the auditor dashboard to accept or decline this assignment within 48 hours.`,
          type:        'SYSTEM',
          category:    'APPLICATION',
          referenceId: sub.reference_number,
        }).catch(e => console.error('[MESSENGER] assign sendMessage (auditor) failed:', e.message));

        if (auditorEmailResolved && auditorEmailResolved.includes('@')) {
          notifyAuditorAssigned({
            auditorEmail:    auditorEmailResolved,
            auditorName:     auditorFullName,
            tokenSymbol:     sub.token_symbol,
            entityName:      sub.entity_name,
            referenceNumber: sub.reference_number,
          }).catch(e => console.error('[MAILER] assign notifyAuditorAssigned failed:', e.message));
        } else {
          console.warn(`[MAILER] assign: could not send auditor email — resolved value is not an email address (submission ${req.params.id}, auditorUUID ${auditorUUID})`);
        }
      }

      // Notify issuer
      if (sub.issuer_wallet) {
        await sendMessage({
          recipientId: sub.issuer_wallet,
          subject:     `🔍 Auditor Assigned — ${sub.token_symbol}`,
          body:        `An auditor has been assigned to your tokenisation application for ${sub.entity_name} (${sub.token_symbol}).\n\nThe auditor will contact you directly to agree the scope and fee. Please have your documents ready.\n\nReference: ${sub.reference_number}`,
          type:        'SYSTEM',
          category:    'APPLICATION',
          referenceId: sub.reference_number,
        }).catch(e => console.error('[MESSENGER] assign sendMessage (issuer) failed:', e.message));
      }

      // Confirm to admin
      await sendMessage({
        recipientId: req.user.userId,
        subject:     `✅ Auditor Assigned — ${sub.token_symbol}`,
        body:        `Auditor successfully assigned to ${sub.entity_name} (${sub.token_symbol}).\n\nAssigned to: ${auditorEmailResolved || auditorUUID}\nReference: ${sub.reference_number}`,
        type:        'SYSTEM',
        category:    'APPLICATION',
      }).catch(e => console.error('[MESSENGER] assign sendMessage (admin confirm) failed:', e.message));

      res.json({ success: true, assignedAuditor, message: `Submission assigned to ${assignedAuditor}` });
    } catch (err) {
      res.status(500).json({ error: 'Could not assign auditor: ' + err.message });
    }
  }
);

// ── PUT /api/submissions/:id/status ────────────────────────────
router.put('/:id/status',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { status, notes } = req.body;
    const valid = ['REJECTED','UNDER_REVIEW','INFO_REQUESTED','APPROVED'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
    }
    try {
      await db.execute(`
        UPDATE data_submissions
        SET status = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [status, notes || null, req.params.id]);
      res.json({ success: true, status, message: `Submission marked as ${status}` });
    } catch (err) {
      res.status(500).json({ error: 'Could not update status' });
    }
  }
);

// ── PUT /api/submissions/:id/audit-report ──────────────────────
router.put('/:id/audit-report',
  authenticate,
  requireRole('ADMIN', 'AUDITOR'),
  async (req, res) => {
    const {
      findings, methodology, riskRating, recommendation,
      caveats, certifiedPrice, valuationMethod,
      yearsOfFinancials, annualRevenueUsd,
    } = req.body;

    if (!certifiedPrice || !riskRating || !recommendation) {
      return res.status(400).json({
        error: 'certifiedPrice, riskRating, and recommendation are required'
      });
    }

    const auditReport = {
      auditorId:           req.user.userId,
      auditorWallet:       req.user.wallet || req.user.userId,
      reportDate:          new Date().toISOString(),
      findings:            findings || '',
      methodology:         methodology || '',
      riskRating,
      recommendation,
      caveats:             caveats || '',
      certifiedPrice:      parseFloat(certifiedPrice),
      valuationMethod:     valuationMethod || 'Independent Appraisal',
      yearsOfFinancials:   parseInt(yearsOfFinancials) || 0,
      annualRevenueUsd:    parseFloat(annualRevenueUsd) || 0,
      suggestedListingType:
        (parseInt(yearsOfFinancials) >= 3 && parseFloat(annualRevenueUsd) >= 1500000)
          ? 'BROWNFIELD_BOURSE'
          : 'GREENFIELD_P2P',
    };

    try {
      const newStatus = recommendation === 'APPROVE'
        ? 'AUDITOR_APPROVED'
        : recommendation === 'REJECT'
          ? 'REJECTED'
          : 'INFO_REQUESTED';

      await db.execute(`
        UPDATE data_submissions
        SET audit_report = ?, status = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        JSON.stringify(auditReport), newStatus,
        `${riskRating} risk. ${recommendation}. Price: $${parseFloat(certifiedPrice).toFixed(4)}.${caveats ? ' Caveats: '+caveats : ''}`,
        req.params.id,
      ]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['AUDIT_REPORT_SUBMITTED', req.user.wallet || req.user.userId, req.params.id,
         `Status: ${newStatus}. Price: $${parseFloat(certifiedPrice).toFixed(4)}. Risk: ${riskRating}`]
      );

      res.json({ success: true, status: newStatus, auditReport,
                 message: `Audit report submitted. Submission ${newStatus}.` });
    } catch (err) {
      res.status(500).json({ error: 'Could not save audit report: ' + err.message });
    }
  }
);

// ── PUT /api/submissions/:id/admin-approve ─────────────────────
router.put('/:id/admin-approve',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { listingType, adminNotes, tokenSymbol } = req.body;

    if (!['GREENFIELD_P2P','BROWNFIELD_BOURSE'].includes(listingType)) {
      return res.status(400).json({ error: 'listingType must be GREENFIELD_P2P or BROWNFIELD_BOURSE' });
    }

    try {
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

      const sub = rows[0];

      if (sub.status !== 'AUDITOR_APPROVED') {
        return res.status(422).json({
          error: `Cannot approve: submission status is '${sub.status}'. Admin final approval requires the submission to be in AUDITOR_APPROVED status.`,
        });
      }

      const auditReport    = sub.audit_report
        ? (typeof sub.audit_report === 'string' ? JSON.parse(sub.audit_report) : sub.audit_report)
        : {};
      const certifiedPrice = parseFloat(auditReport.certifiedPrice || 1.0);
      const symbol         = tokenSymbol || sub.token_symbol;
      const trading_mode   = listingType === 'GREENFIELD_P2P' ? 'P2P_ONLY' : 'FULL_TRADING';
      const total_supply   = sub.total_supply || 1000000;

      await db.execute(`
        UPDATE data_submissions
        SET status = 'TOKENIZATION_PENDING', listing_type = ?,
            admin_approved_by = ?, admin_approved_at = NOW(), admin_notes = ?
        WHERE id = ?
      `, [listingType, req.user.userId, adminNotes || null, req.params.id]);

      // Ensure token record exists in PENDING state (do NOT activate it yet)
      const [existingToken] = await db.execute(
        'SELECT id FROM tokens WHERE token_symbol = ?', [symbol.toUpperCase()]
      );

      if (existingToken.length > 0) {
        await db.execute(`
          UPDATE tokens
          SET listing_type = ?, current_price_usd = ?,
              trading_mode = ?, updated_at = NOW()
          WHERE token_symbol = ?
        `, [listingType, certifiedPrice, trading_mode, symbol.toUpperCase()]);
      } else {
        await db.execute(`
          INSERT INTO tokens
            (symbol, name, company_name, token_symbol, token_name,
             asset_type, asset_class, issuer_id,
             total_supply, current_price_usd, price_usd,
             market_cap, trading_mode, market_state, status,
             listing_type, jurisdiction, submission_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?)
        `, [
          symbol.toUpperCase(), sub.entity_name || symbol, sub.entity_name || symbol,
          symbol.toUpperCase(), sub.entity_name || symbol,
          sub.asset_type || 'EQUITY', sub.asset_type || 'EQUITY', sub.issuer_wallet || null,
          total_supply, certifiedPrice, certifiedPrice,
          parseFloat(certifiedPrice) * total_supply, trading_mode,
          listingType, sub.jurisdiction || 'Zimbabwe', req.params.id
        ]);
      }

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['ADMIN_FINAL_APPROVAL', req.user.wallet || req.user.userId, symbol,
         `Listing type: ${listingType}. Certified price: $${certifiedPrice}. Notes: ${adminNotes||'None'}. Status: TOKENIZATION_PENDING.`]
      );

      // Create compliance fee record and notify issuer
      const { getNumericSetting } = require('../utils/platformSettings');
      const { sendMessage } = require('../utils/messenger');
      const { notifyIssuerApplicationApproved } = require('../utils/mailer');

      const complianceFee = await getNumericSetting('compliance_fee_usd', 1500);
      const feeRef = `TEXZ-APP-${req.params.id}`;

      await db.execute(
        `INSERT INTO application_fees (submission_id, token_symbol, fee_type, amount_usd, reference, status)
         VALUES (?, ?, 'COMPLIANCE_REVIEW', ?, ?, 'PENDING')
         ON CONFLICT DO NOTHING`,
        [req.params.id, sub.token_symbol, complianceFee, feeRef]
      );

      const [bankSettings] = await db.execute(
        "SELECT key, value FROM platform_settings WHERE key IN ('bank_name','bank_account_name','bank_account_number','bank_branch','bank_swift_code')"
      );
      const bankMap = {};
      bankSettings.forEach(s => { bankMap[s.key] = s.value; });

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `✅ Committee Approved — Compliance Fee Due: ${sub.token_symbol}`,
        body:        `Your tokenisation application for ${sub.entity_name} (${sub.token_symbol}) has been approved by the Applications Appraisal Committee.\n\nCompliance Review Fee: $${complianceFee.toFixed(2)} USD\nPayment Reference: ${feeRef}\nBank: ${bankMap.bank_name || 'Stanbic Bank Zimbabwe'}\nAccount Name: ${bankMap.bank_account_name || 'TokenEquityX Ltd'}\nSWIFT: ${bankMap.bank_swift_code || 'SBICZWHX'}\n\nEmail proof of payment to admin@tokenequityx.co.zw. Payment must be received within 7 business days.`,
        type:        'SYSTEM',
        category:    'APPLICATION',
      }).catch(e => console.error('[MESSENGER] admin-approve sendMessage failed:', e.message));

      const [issuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      const issuer = issuerRows[0];
      if (issuer?.email) {
        notifyIssuerApplicationApproved({
          issuerEmail:    issuer.email,
          issuerName:     issuer.full_name,
          tokenSymbol:    sub.token_symbol,
          entityName:     sub.entity_name,
          complianceFee,
          paymentRef:     feeRef,
          bankName:       bankMap.bank_name,
          bankAccountName:bankMap.bank_account_name,
          bankAccountNo:  bankMap.bank_account_number,
          bankBranch:     bankMap.bank_branch,
          bankSwift:      bankMap.bank_swift_code,
        }).catch(e => console.error('[MAILER] admin-approve email failed:', e.message));
      } else {
        console.warn(`[MAILER] admin-approve: no email found for issuer_wallet=${sub.issuer_wallet} (submission ${req.params.id})`);
      }

      res.json({
        success: true, listingType, certifiedPrice, symbol: symbol.toUpperCase(),
        message: `${symbol.toUpperCase()} approved by committee. Status: TOKENIZATION_PENDING. Next: submit to SECZ for regulatory review.`,
      });
    } catch (err) {
      res.status(500).json({ error: 'Admin approval failed: ' + err.message });
    }
  }
);

// ── GET /api/submissions/:id/audit-report ─────────────────────
router.get('/:id/audit-report', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, token_symbol, status, audit_report, listing_type, admin_notes, admin_approved_at FROM data_submissions WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const sub = rows[0];
    if (sub.audit_report) sub.audit_report = JSON.parse(sub.audit_report);
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch audit report' });
  }
});
// ═══════════════════════════════════════════════════════════════════
// ADD THESE TWO ROUTES TO submissions.js
// Insert them BEFORE the last line: module.exports = router;
// ═══════════════════════════════════════════════════════════════════

// ── PUT /api/submissions/:id/suspend — suspend or unsuspend an application
router.put('/:id/suspend',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

      const sub = rows[0];
      const isSuspended = sub.status === 'SUSPENDED';
      const newStatus = isSuspended ? 'PENDING' : 'SUSPENDED';
      const notes = isSuspended
        ? `Application reinstated by Admin on ${new Date().toLocaleDateString()}`
        : `Application suspended by Admin on ${new Date().toLocaleDateString()}${reason ? ': ' + reason : ''}`;

      await db.execute(
        'UPDATE data_submissions SET status = ?, auditor_notes = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, notes, req.params.id]
      );

      // Log to audit_logs
      try {
        await db.execute(
          `INSERT INTO audit_logs (action, performed_by, target_entity, details)
           VALUES (?, ?, ?, ?)`,
          [
            isSuspended ? 'SUBMISSION_REINSTATED' : 'SUBMISSION_SUSPENDED',
            req.user.userId,
            `submission:${req.params.id}`,
            notes,
          ]
        );
      } catch {}

      res.json({
        success: true,
        status: newStatus,
        message: isSuspended
          ? `Submission ${req.params.id} reinstated.`
          : `Submission ${req.params.id} suspended.`,
      });
    } catch (err) {
      console.error('Suspend submission error:', err);
      res.status(500).json({ error: 'Failed to update submission status' });
    }
  }
);

// ── DELETE /api/submissions/:id — permanently delete a submission
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Submission not found' });
      }

      const sub = rows[0];

      // Delete child records first to avoid FK constraint errors
      await conn.execute('DELETE FROM oracle_prices WHERE submission_id = ?', [req.params.id]).catch(() => {});
      await conn.execute('DELETE FROM valuations WHERE submission_id = ?', [req.params.id]).catch(() => {});

      // Delete the submission
      await conn.execute('DELETE FROM data_submissions WHERE id = ?', [req.params.id]);

      // Log deletion
      try {
        await conn.execute(
          `INSERT INTO audit_logs (action, performed_by, target_entity, details)
           VALUES (?, ?, ?, ?)`,
          [
            'SUBMISSION_DELETED',
            req.user.userId,
            `submission:${req.params.id}`,
            `Submission for ${sub.token_symbol || sub.entity_name || req.params.id} permanently deleted by Admin on ${new Date().toLocaleDateString()}`,
          ]
        );
      } catch {}

      await conn.commit();
      res.json({ success: true, message: `Submission ${req.params.id} permanently deleted.` });
    } catch (err) {
      await conn.rollback();
      console.error('Delete submission error:', err);
      res.status(500).json({ error: 'Failed to delete submission' });
    } finally {
      conn.release();
    }
  }
);

// GET /api/submissions/:id/document-url?path=folder/filename
// Generates a fresh signed URL for a document (signed URLs expire)
router.get('/:id/document-url', authenticate, async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  try {
    const { getSignedUrl } = require('../middleware/upload');
    const url = await getSignedUrl(filePath, 3600); // 1 hour
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/submissions/:id — issuer deletes their own DRAFT/PENDING submission and token
router.delete('/:id', authenticate, requireRole('ISSUER','ADMIN'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch submission
    const [rows] = await conn.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Submission not found' });
    }
    const sub = rows[0];

    // Verify ownership (issuers can only delete their own)
    if (req.user.role === 'ISSUER' && sub.issuer_wallet !== req.user.userId) {
      await conn.rollback();
      return res.status(403).json({ error: 'You can only delete your own submissions' });
    }

    // Only allow deletion of PENDING/UNDER_REVIEW/REJECTED submissions
    if (!['PENDING','UNDER_REVIEW','REJECTED'].includes(sub.status) && req.user.role !== 'ADMIN') {
      await conn.rollback();
      return res.status(400).json({ error: `Cannot delete a submission with status: ${sub.status}. Only PENDING or REJECTED submissions can be deleted.` });
    }

    const symbol = sub.token_symbol;

    // Delete submission
    await conn.execute('DELETE FROM data_submissions WHERE id = ?', [req.params.id]);
    await conn.execute('DELETE FROM application_fees WHERE token_symbol = ?', [symbol]);

    // Delete the token and SPV if token is still DRAFT
    const [tokens] = await conn.execute(
      'SELECT id, spv_id, status FROM tokens WHERE token_symbol = ?', [symbol]
    );
    if (tokens.length > 0 && tokens[0].status === 'DRAFT') {
      const tokenId = tokens[0].id;
      const spvId   = tokens[0].spv_id;
      await conn.execute('DELETE FROM token_holdings WHERE token_id = ?', [tokenId]);
      await conn.execute('DELETE FROM p2p_offers WHERE token_symbol = ?', [symbol]);
      await conn.execute('DELETE FROM tokens WHERE id = ?', [tokenId]);
      if (spvId) await conn.execute('DELETE FROM spvs WHERE id = ?', [spvId]);
    }

    await conn.commit();
    res.json({ success: true, message: `Submission for ${symbol} deleted successfully.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Could not delete submission: ' + err.message });
  } finally {
    conn.release();
  }
});

// POST /api/submissions/unified — create SPV + token + submission in one atomic transaction
router.post('/unified', authenticate, requireRole('ISSUER','ADMIN'), upload.fields([
  { name: 'certificate',   maxCount: 1 },
  { name: 'prospectus',    maxCount: 1 },
  { name: 'financials',    maxCount: 1 },
  { name: 'valuation',     maxCount: 1 },
  { name: 'kyc_docs',      maxCount: 1 },
  { name: 'legal_opinion', maxCount: 1 },
  { name: 'regulatory',    maxCount: 1 },
]), async (req, res) => {
  const {
    legalName, registrationNumber, jurisdiction, sector, assetType,
    description, websiteUrl, foundedYear, headquarters, useOfProceeds, numEmployees,
    tokenName, tokenSymbol, authorisedShares, nominalValueCents,
    targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield, distributionFrequency,
    ceo_name, ceo_email, ceo_id,
    cfo_name, cfo_email, cfo_id,
    legal_name, legal_email, legal_id,
    assetDescription, assetClass,
  } = req.body;

  if (!legalName || !registrationNumber || !tokenSymbol || !tokenName) {
    return res.status(400).json({ error: 'legalName, registrationNumber, tokenSymbol and tokenName are required' });
  }

  const sym = tokenSymbol.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute('SELECT id FROM tokens WHERE token_symbol = ?', [sym]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: `Token symbol ${sym} is already taken. Please choose a different symbol.` });
    }

    const [existingSpv] = await conn.execute('SELECT id FROM spvs WHERE registration_number = ?', [registrationNumber]);
    if (existingSpv.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: `Registration number ${registrationNumber} already exists.` });
    }

    const [spvResult] = await conn.execute(`
      INSERT INTO spvs (owner_user_id, legal_name, registration_no, registration_number,
        jurisdiction, sector, asset_type, description, website_url, founded_year,
        headquarters, use_of_proceeds, num_employees)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      req.user.userId, legalName, registrationNumber, registrationNumber,
      jurisdiction || 'ZW', sector || 'OTHER', assetType || 'EQUITY',
      description || assetDescription || null,
      websiteUrl || null, foundedYear ? parseInt(foundedYear) : null,
      headquarters || null, useOfProceeds || null, numEmployees || null
    ]);
    const spvId = spvResult[0].id;

    const shares = parseInt(authorisedShares || totalSupply || 1000000);
    const nomVal = parseInt(nominalValueCents || 100);
    const price  = parseFloat(tokenIssuePrice || 1.00);

    await conn.execute(`
      INSERT INTO tokens (spv_id, symbol, name, company_name, token_name, token_symbol, ticker,
        asset_type, asset_class, authorised_shares, issued_shares, nominal_value_cents,
        total_supply, price_usd, current_price_usd, oracle_price,
        market_state, status, jurisdiction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRE_LAUNCH', 'DRAFT', ?)
    `, [
      spvId, sym, tokenName, legalName, tokenName, sym, sym,
      assetType || 'EQUITY', assetClass || assetType || 'EQUITY',
      shares, shares, nomVal, shares, price, price, price,
      jurisdiction || 'ZW'
    ]);

    // Upload documents to Supabase
    const supabase = require('../utils/supabase');
    const uploadedDocs = {};
    if (req.files) {
      for (const [docKey, fileArr] of Object.entries(req.files)) {
        const file = fileArr[0];
        const filePath = `submissions/${sym}/${docKey}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
          uploadedDocs[docKey] = { name: file.originalname, url: urlData.publicUrl, path: filePath, size: file.size };
        } else {
          console.error(`[UPLOAD] Failed to upload ${docKey}:`, uploadError.message);
        }
      }
    }

    const dataJson = JSON.stringify({
      financialData: { targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield, distributionFrequency },
      keyPersonnel: [
        { role: 'CEO',           name: ceo_name,   email: ceo_email,   idNumber: ceo_id },
        { role: 'CFO',           name: cfo_name,   email: cfo_email,   idNumber: cfo_id },
        { role: 'Legal Counsel', name: legal_name, email: legal_email, idNumber: legal_id },
      ].filter(p => p.name),
      sector, assetType, assetClass,
      description: description || assetDescription,
      documents: uploadedDocs,
    });

    const refNum = `${sym.toLowerCase()}-${Date.now().toString(36)}`;
    await conn.execute(`
      INSERT INTO data_submissions
        (token_symbol, entity_name, submission_type, status, application_status,
         fee_status, issuer_wallet, reference_number, data_json, document_count)
      VALUES (?, ?, 'TOKENISATION_APPLICATION', 'PENDING', 'PENDING_REVIEW', 'NOT_REQUIRED', ?, ?, ?, ?)
    `, [sym, legalName, req.user.userId, refNum, dataJson, Object.keys(uploadedDocs).length]);

    await conn.execute(
      'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
      ['TOKENISATION_APPLICATION', req.user.userId, sym, `Entity: ${legalName}, Ref: ${refNum}`]
    );

    await conn.commit();

    // Notify issuer — application received
    const { sendMessage } = require('../utils/messenger');
    await sendMessage({
      recipientId: req.user.userId,
      subject:     `📋 Application Received — ${sym}`,
      body:        `Your tokenisation application for ${legalName} (${sym}) has been received.\n\nReference: ${refNum}\n\nYour application will be reviewed at the next Applications Appraisal Meeting (every Tuesday). You will receive a notification once the committee has reviewed your submission.\n\nNext steps:\n1. Await committee review\n2. If approved, you will receive a compliance fee invoice and auditor assignment\n3. The auditor will contact you directly to agree scope and fee\n4. Once review is complete, admin gives final approval\n5. You can then propose a primary offering`,
      type:        'SYSTEM',
      category:    'APPLICATION',
      referenceId: refNum,
    }).catch(e => console.error('[MESSENGER] unified/submit sendMessage (issuer) failed:', e.message));

    // Notify admin — new application
    const [adminRows] = await db.execute(
      "SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1"
    );
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `🆕 New Application — ${sym}`,
        body:        `A new tokenisation application has been submitted.\n\nCompany: ${legalName}\nToken Symbol: ${sym}\nAsset Type: ${assetType || 'BOND'}\nSector: ${sector || 'N/A'}\nReference: ${refNum}\n\nPlease review at the next Applications Appraisal Meeting and approve or reject via the Pipeline tab.`,
        type:        'SYSTEM',
        category:    'APPLICATION',
        referenceId: refNum,
      }).catch(e => console.error('[MESSENGER] unified/submit sendMessage (admin) failed:', e.message));
    }

    res.json({
      success: true,
      message: `Application for ${sym} submitted successfully. Reference: ${refNum}`,
      tokenSymbol: sym,
      referenceNumber: refNum,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Submission failed: ' + err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/submissions/:id/auditor-accept — auditor accepts assignment
router.put('/:id/auditor-accept', authenticate, requireRole('AUDITOR'), async (req, res) => {
  const { sendMessage } = require('../utils/messenger');
  try {
    const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = rows[0];

    // assigned_auditor is now always stored as UUID
    if (sub.assigned_auditor !== req.user.userId) {
      return res.status(403).json({ error: 'This submission is not assigned to you' });
    }

    await db.execute(
      "UPDATE data_submissions SET auditor_status = 'ACCEPTED', updated_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `✅ Auditor Accepted — ${sub.token_symbol}`,
        body:        `The auditor assigned to ${sub.token_symbol} (${sub.entity_name}) has accepted the assignment and will commence review.\n\nReference: ${sub.reference_number}`,
        type: 'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
      }).catch(e => console.error('[MESSENGER] auditor-accept sendMessage (admin) failed:', e.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `✅ Auditor Accepted — ${sub.token_symbol}`,
      body:        `Your nominated auditor has accepted the assignment for ${sub.entity_name} (${sub.token_symbol}).\n\nThe auditor will contact you directly to agree the scope and fee. Please have your documents ready.\n\nReference: ${sub.reference_number}`,
      type: 'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
    }).catch(e => console.error('[MESSENGER] auditor-accept sendMessage (issuer) failed:', e.message));

    res.json({ success: true, message: 'Assignment accepted. Issuer and admin have been notified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/submissions/:id/auditor-decline — auditor declines assignment
router.put('/:id/auditor-decline', authenticate, requireRole('AUDITOR'), async (req, res) => {
  const { reason } = req.body;
  const { sendMessage } = require('../utils/messenger');
  try {
    const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = rows[0];

    // assigned_auditor is now always stored as UUID
    if (sub.assigned_auditor !== req.user.userId) {
      return res.status(403).json({ error: 'This submission is not assigned to you' });
    }

    await db.execute(
      "UPDATE data_submissions SET auditor_status = 'DECLINED', auditor_declined_reason = ?, updated_at = NOW() WHERE id = ?",
      [reason || 'No reason provided', req.params.id]
    );

    const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `❌ Auditor Declined — ${sub.token_symbol}`,
        body:        `The auditor assigned to ${sub.token_symbol} (${sub.entity_name}) has declined the assignment.\n\nReason: ${reason || 'Not provided'}\n\nPlease nominate a new auditor via the Pipeline tab.\n\nReference: ${sub.reference_number}`,
        type: 'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
      }).catch(e => console.error('[MESSENGER] auditor-decline sendMessage (admin) failed:', e.message));
    }

    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `⚠️ Auditor Update — ${sub.token_symbol}`,
      body:        `The nominated auditor was unable to accept the assignment for ${sub.entity_name} (${sub.token_symbol}).\n\nTokenEquityX will nominate a replacement auditor shortly. You will be notified once a new auditor is assigned.\n\nReference: ${sub.reference_number}`,
      type: 'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
    }).catch(e => console.error('[MESSENGER] auditor-decline sendMessage (issuer) failed:', e.message));

    res.json({ success: true, message: 'Declination recorded. Admin and issuer have been notified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/submissions/unified — issuer updates their existing PENDING submission
router.put('/unified', authenticate, requireRole('ISSUER','ADMIN'),
  upload.fields([
    { name: 'certificate',   maxCount: 1 },
    { name: 'prospectus',    maxCount: 1 },
    { name: 'financials',    maxCount: 1 },
    { name: 'valuation',     maxCount: 1 },
    { name: 'kyc_docs',      maxCount: 1 },
    { name: 'legal_opinion', maxCount: 1 },
    { name: 'regulatory',    maxCount: 1 },
  ]),
  async (req, res) => {
    const { editingId, legalName, tokenSymbol, tokenName, targetRaiseUsd,
            tokenIssuePrice, totalSupply, expectedYield, distributionFrequency,
            ceo_name, ceo_email, ceo_id, cfo_name, cfo_email, cfo_id,
            legal_name, legal_email, legal_id, description, assetDescription,
            sector, assetType, assetClass, useOfProceeds } = req.body;

    if (!editingId) return res.status(400).json({ error: 'editingId is required for updates' });

    try {
      const [rows] = await db.execute(
        'SELECT * FROM data_submissions WHERE id = ? AND issuer_wallet = ?',
        [editingId, req.user.userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found or access denied' });
      const sub = rows[0];
      if (!['PENDING', 'UNDER_REVIEW', 'REJECTED'].includes(sub.status)) {
        return res.status(400).json({ error: `Cannot edit a submission with status: ${sub.status}` });
      }

      const supabase = require('../utils/supabase');
      const sym = sub.token_symbol;
      const existingData = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json || '{}') : (sub.data_json || {});
      const uploadedDocs = existingData.documents || {};

      if (req.files) {
        for (const [docKey, fileArr] of Object.entries(req.files)) {
          const file = fileArr[0];
          const filePath = `submissions/${sym}/${docKey}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
            uploadedDocs[docKey] = { name: file.originalname, url: urlData.publicUrl, path: filePath, size: file.size };
          }
        }
      }

      const dataJson = JSON.stringify({
        ...existingData,
        financialData: { targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield, distributionFrequency },
        keyPersonnel: [
          { role: 'CEO',           name: ceo_name,   email: ceo_email,   idNumber: ceo_id },
          { role: 'CFO',           name: cfo_name,   email: cfo_email,   idNumber: cfo_id },
          { role: 'Legal Counsel', name: legal_name, email: legal_email, idNumber: legal_id },
        ].filter(p => p.name),
        sector, assetType, assetClass,
        description: description || assetDescription,
        useOfProceeds,
        documents: uploadedDocs,
      });

      await db.execute(
        `UPDATE data_submissions SET
          entity_name = ?, data_json = ?, document_count = ?,
          status = 'PENDING', application_status = 'PENDING_REVIEW',
          updated_at = NOW()
         WHERE id = ?`,
        [legalName || sub.entity_name, dataJson, Object.keys(uploadedDocs).length, editingId]
      );

      res.json({ success: true, message: `Application for ${sym} updated successfully.`, tokenSymbol: sym });
    } catch (err) {
      res.status(500).json({ error: 'Update failed: ' + err.message });
    }
  }
);

// PUT /api/submissions/:id/soft-delete — admin soft deletes a submission (90-day appeal window)
router.put('/:id/soft-delete', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Deletion reason is required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM data_submissions WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found or already deleted' });
    const sub = rows[0];

    await conn.execute(
      'UPDATE data_submissions SET deleted_at = NOW(), deleted_by = ?, deletion_reason = ?, status = \'SUSPENDED\', updated_at = NOW() WHERE id = ?',
      [req.user.userId, reason, req.params.id]
    );

    await conn.execute(
      `UPDATE tokens SET status = 'SUSPENDED', market_state = 'PRE_LAUNCH',
       suspended_at = NOW(), suspended_by = ?, suspension_reason = ?, updated_at = NOW()
       WHERE token_symbol = ?`,
      [req.user.userId, reason, sub.token_symbol]
    );

    const { sendMessage } = require('../utils/messenger');
    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `⚠️ Listing Suspended — ${sub.token_symbol}`,
      body:        `Your listing for ${sub.entity_name} (${sub.token_symbol}) has been suspended by the platform administrator.\n\nReason: ${reason}\n\nYour data will be retained for 90 days from this date. You may appeal this decision by contacting compliance@tokenequityx.co.zw within 90 days.\n\nIf no appeal is received within 90 days, all data will be permanently deleted.\n\nReference: ${sub.reference_number}`,
      type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
    }).catch(e => console.error('[MESSENGER] suspend sendMessage (issuer) failed:', e.message));

    await conn.commit();
    res.json({ success: true, message: `${sub.token_symbol} suspended. Data retained for 90-day appeal window.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// PUT /api/submissions/:id/reinstate — admin reinstates a soft-deleted submission
router.put('/:id/reinstate', authenticate, requireRole('ADMIN'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM data_submissions WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found or not suspended' });
    const sub = rows[0];

    const deletedAt = new Date(sub.deleted_at);
    const daysSince = Math.floor((Date.now() - deletedAt.getTime()) / 86400000);
    if (daysSince > 90) return res.status(400).json({ error: 'Appeal window has expired (90 days). Data cannot be reinstated.' });

    await conn.execute(
      'UPDATE data_submissions SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, status = \'PENDING\', updated_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    await conn.execute(
      "UPDATE tokens SET status = 'DRAFT', market_state = 'PRE_LAUNCH', suspended_at = NULL, suspended_by = NULL, suspension_reason = NULL WHERE token_symbol = ?",
      [sub.token_symbol]
    );

    const { sendMessage } = require('../utils/messenger');
    await sendMessage({
      recipientId: sub.issuer_wallet,
      subject:     `✅ Listing Reinstated — ${sub.token_symbol}`,
      body:        `Your listing for ${sub.entity_name} (${sub.token_symbol}) has been reinstated by the platform administrator. Your application is now back in PENDING status.\n\nReference: ${sub.reference_number}`,
      type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
    }).catch(e => console.error('[MESSENGER] reinstate sendMessage (issuer) failed:', e.message));

    await conn.commit();
    res.json({ success: true, message: `${sub.token_symbol} reinstated successfully.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// ── PUT /api/submissions/:id/submit-to-secz ────────────────────
router.put('/:id/submit-to-secz',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

      const sub = rows[0];
      if (sub.status !== 'TOKENIZATION_PENDING') {
        return res.status(422).json({
          error: `Cannot submit to SECZ: submission status is '${sub.status}'. Required: TOKENIZATION_PENDING.`,
        });
      }

      await db.execute(
        "UPDATE data_submissions SET status = 'SECZ_REVIEW', updated_at = NOW() WHERE id = ?",
        [req.params.id]
      );

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['SECZ_REVIEW_SUBMITTED', req.user.wallet || req.user.userId, sub.token_symbol,
         `Submitted to SECZ for regulatory review.`]
      );

      const { sendMessage } = require('../utils/messenger');
      const { notifyIssuerSeczSubmitted } = require('../utils/mailer');

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `🏛️ Submitted to SECZ — ${sub.token_symbol}`,
        body:        `Your tokenisation application for ${sub.entity_name} (${sub.token_symbol}) has been submitted to the Securities and Exchange Commission of Zimbabwe (SECZ) for regulatory review. You will be notified once a decision is made.`,
        type:        'SYSTEM',
        category:    'APPLICATION',
      }).catch(e => console.error('[MESSENGER] submit-to-secz sendMessage failed:', e.message));

      const [issuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      const issuer = issuerRows[0];
      if (issuer?.email) {
        notifyIssuerSeczSubmitted({
          issuerEmail: issuer.email,
          issuerName:  issuer.full_name,
          tokenSymbol: sub.token_symbol,
          entityName:  sub.entity_name,
        }).catch(e => console.error('[MAILER] submit-to-secz notifyIssuerSeczSubmitted failed:', e.message));
      } else {
        console.warn(`[MAILER] submit-to-secz: no email found for issuer_wallet=${sub.issuer_wallet}`);
      }

      res.json({ success: true, status: 'SECZ_REVIEW', message: `${sub.token_symbol} submitted to SECZ for regulatory review.` });
    } catch (err) {
      res.status(500).json({ error: 'Submit to SECZ failed: ' + err.message });
    }
  }
);

// ── PUT /api/submissions/:id/secz-approve ──────────────────────
router.put('/:id/secz-approve',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

      const sub = rows[0];
      if (sub.status !== 'SECZ_REVIEW') {
        return res.status(422).json({
          error: `Cannot record SECZ approval: submission status is '${sub.status}'. Required: SECZ_REVIEW.`,
        });
      }

      await db.execute(
        "UPDATE data_submissions SET status = 'SECZ_APPROVED', updated_at = NOW() WHERE id = ?",
        [req.params.id]
      );

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['SECZ_APPROVED', req.user.wallet || req.user.userId, sub.token_symbol,
         `SECZ regulatory approval recorded. Ready to go live.`]
      );

      const { sendMessage } = require('../utils/messenger');
      const { notifyIssuerSeczApproved } = require('../utils/mailer');

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `✅ SECZ Approved — ${sub.token_symbol}`,
        body:        `Great news! Your tokenisation application for ${sub.entity_name} (${sub.token_symbol}) has received regulatory approval from SECZ. Your token is now ready to be set live on the TokenEquityX platform. You will be notified when trading begins.`,
        type:        'SYSTEM',
        category:    'APPLICATION',
      }).catch(e => console.error('[MESSENGER] secz-approve sendMessage failed:', e.message));

      const [issuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      const issuer = issuerRows[0];
      if (issuer?.email) {
        notifyIssuerSeczApproved({
          issuerEmail: issuer.email,
          issuerName:  issuer.full_name,
          tokenSymbol: sub.token_symbol,
          entityName:  sub.entity_name,
        }).catch(e => console.error('[MAILER] secz-approve notifyIssuerSeczApproved failed:', e.message));
      } else {
        console.warn(`[MAILER] secz-approve: no email found for issuer_wallet=${sub.issuer_wallet}`);
      }

      res.json({ success: true, status: 'SECZ_APPROVED', message: `${sub.token_symbol} SECZ approval recorded. Ready to set live.` });
    } catch (err) {
      res.status(500).json({ error: 'SECZ approve failed: ' + err.message });
    }
  }
);

// ── PUT /api/submissions/:id/set-live ─────────────────────────
router.put('/:id/set-live',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

      const sub = rows[0];
      if (sub.status !== 'SECZ_APPROVED') {
        return res.status(422).json({
          error: `Cannot set live: submission status is '${sub.status}'. Required: SECZ_APPROVED.`,
        });
      }

      const auditReport    = sub.audit_report
        ? (typeof sub.audit_report === 'string' ? JSON.parse(sub.audit_report) : sub.audit_report)
        : {};
      const certifiedPrice = parseFloat(auditReport.certifiedPrice || 1.0);
      const symbol         = sub.token_symbol;
      const listingType    = sub.listing_type || 'GREENFIELD_P2P';
      const trading_mode   = listingType === 'GREENFIELD_P2P' ? 'P2P_ONLY' : 'FULL_TRADING';
      const total_supply   = sub.total_supply || 1000000;

      const [existingToken] = await db.execute(
        'SELECT id FROM tokens WHERE token_symbol = ?', [symbol.toUpperCase()]
      );

      if (existingToken.length > 0) {
        await db.execute(`
          UPDATE tokens
          SET trading_mode = ?, market_state = 'FULL_TRADING',
              status = 'ACTIVE', market_cap = ?, listed_at = NOW(), updated_at = NOW()
          WHERE token_symbol = ?
        `, [trading_mode, parseFloat(certifiedPrice) * total_supply, symbol.toUpperCase()]);
      } else {
        await db.execute(`
          INSERT INTO tokens
            (symbol, name, company_name, token_symbol, token_name,
             asset_type, asset_class, issuer_id,
             total_supply, current_price_usd, price_usd,
             market_cap, trading_mode, market_state, status,
             listing_type, jurisdiction, submission_id, listed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FULL_TRADING', 'ACTIVE', ?, ?, ?, NOW())
        `, [
          symbol.toUpperCase(), sub.entity_name || symbol, sub.entity_name || symbol,
          symbol.toUpperCase(), sub.entity_name || symbol,
          sub.asset_type || 'EQUITY', sub.asset_type || 'EQUITY', sub.issuer_wallet || null,
          total_supply, certifiedPrice, certifiedPrice,
          parseFloat(certifiedPrice) * total_supply, trading_mode,
          listingType, sub.jurisdiction || 'Zimbabwe', req.params.id
        ]);
      }

      await db.execute(
        "UPDATE data_submissions SET status = 'LIVE', updated_at = NOW() WHERE id = ?",
        [req.params.id]
      );

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['TOKEN_SET_LIVE', req.user.wallet || req.user.userId, symbol,
         `Token activated. Price: $${certifiedPrice}. Mode: ${trading_mode}. Listing: ${listingType}.`]
      );

      const { sendMessage } = require('../utils/messenger');
      const { notifyIssuerTokenLive } = require('../utils/mailer');

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `🚀 ${symbol} is Now Live!`,
        body:        `Congratulations! Your token ${sub.entity_name} (${symbol}) is now LIVE on the TokenEquityX platform.\n\nListing Type: ${listingType === 'BROWNFIELD_BOURSE' ? 'Main Bourse' : 'Peer-to-Peer'}\nToken Price: $${certifiedPrice.toFixed(4)} USD\nTrading Mode: ${trading_mode}\n\nYour token is now available for trading. Log in to monitor performance.`,
        type:        'SYSTEM',
        category:    'APPLICATION',
      }).catch(e => console.error('[MESSENGER] set-live sendMessage failed:', e.message));

      const [issuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      const issuer = issuerRows[0];
      if (issuer?.email) {
        notifyIssuerTokenLive({
          issuerEmail:    issuer.email,
          issuerName:     issuer.full_name,
          tokenSymbol:    symbol,
          entityName:     sub.entity_name,
          certifiedPrice,
          listingType,
          tradingMode:    trading_mode,
        }).catch(e => console.error('[MAILER] set-live notifyIssuerTokenLive failed:', e.message));
      } else {
        console.warn(`[MAILER] set-live: no email found for issuer_wallet=${sub.issuer_wallet}`);
      }

      res.json({
        success: true, status: 'LIVE', symbol: symbol.toUpperCase(),
        message: `${symbol} is now LIVE. Token status: ACTIVE. Trading mode: ${trading_mode}.`,
      });
    } catch (err) {
      res.status(500).json({ error: 'Set live failed: ' + err.message });
    }
  }
);

module.exports = router;