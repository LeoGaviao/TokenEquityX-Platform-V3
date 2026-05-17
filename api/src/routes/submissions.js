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
        ['FINANCIAL_SUBMISSION', req.user.userId, tokenSymbol,
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
        ['TOKENISATION_APPLICATION', req.user.userId,
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
        const auditorId = req.user.userId;
        [rows] = await db.execute(`
          SELECT ds.id, ds.token_symbol, ds.status,
                 ds.created_at, ds.auditor_notes, ds.updated_at as reviewed_at,
                 ds.issuer_wallet, ds.assigned_auditor,
                 ds.entity_name, ds.reference_number, ds.submission_type,
                 ds.data_json, ds.application_status, ds.fee_status,
                 ds.auditor_status, ds.auditor_declined_reason, ds.document_count
          FROM data_submissions ds
          WHERE ds.status NOT IN ('APPROVED', 'REJECTED')
          AND ds.assigned_auditor = ?
          ORDER BY ds.created_at ASC
        `, [auditorId]);
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

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(auditorUUID)) {
        return res.status(400).json({ error: `Could not resolve "${assignedAuditor}" to a registered auditor. Please select from the auditor list or use a valid email address.` });
      }

      await db.execute(`
        UPDATE data_submissions
        SET assigned_auditor = ?, status = 'UNDER_REVIEW',
            auditor_notes = COALESCE(auditor_notes, '') || ' | Assigned to: ' || ?
        WHERE id = ?
      `, [auditorUUID, auditorEmailResolved, req.params.id]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['AUDITOR_ASSIGNED', req.user.userId, req.params.id,
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

      // FIX 1.2 — notify issuer when additional information is requested
      if (status === 'INFO_REQUESTED') {
        try {
          const { sendMessage } = require('../utils/messenger');
          const { notifyIssuerInfoRequested } = require('../utils/mailer');
          const UUID_RE_ST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const [stSubRows] = await db.execute(
            'SELECT issuer_wallet, token_symbol, entity_name FROM data_submissions WHERE id = ?',
            [req.params.id]
          );
          const stSub = stSubRows[0];
          if (stSub?.issuer_wallet) {
            await sendMessage({
              recipientId: stSub.issuer_wallet,
              subject:     `⚠️ Action Required — Information Requested — ${stSub.token_symbol}`,
              body:        `Additional information has been requested for your ${stSub.token_symbol} application. Please log in to your issuer portal and provide the requested documents or information.${notes ? '\n\nReviewer\'s notes: ' + notes : ''}`,
              type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
            }).catch(e => console.error('[MESSENGER] status INFO_REQUESTED sendMessage (issuer) failed:', e.message));

            if (UUID_RE_ST.test(stSub.issuer_wallet)) {
              const [stIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [stSub.issuer_wallet]);
              if (stIssuerRows[0]?.email) {
                notifyIssuerInfoRequested({
                  issuerEmail: stIssuerRows[0].email,
                  issuerName:  stIssuerRows[0].full_name,
                  tokenSymbol: stSub.token_symbol,
                  entityName:  stSub.entity_name,
                  notes,
                }).catch(e => console.error('[MAILER] status notifyIssuerInfoRequested failed:', e.message));
              }
            }
          }
        } catch (notifyErr) {
          console.error('[STATUS-CHANGE] INFO_REQUESTED notification error (non-fatal):', notifyErr.message);
        }
      }

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
      auditorWallet:       req.user.userId,
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
      const [subRows] = await db.execute(
        'SELECT id, status, audit_report, issuer_wallet, token_symbol, entity_name FROM data_submissions WHERE id = ?',
        [req.params.id]
      );
      if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found' });
      const currentSub = subRows[0];

      // Allow re-submission only at stages where it still makes sense
      const ALLOW_RESUBMIT = ['UNDER_REVIEW', 'INFO_REQUESTED', 'AUDITOR_APPROVED', 'TOKENIZATION_PENDING'];
      if (currentSub.audit_report && !ALLOW_RESUBMIT.includes(currentSub.status)) {
        return res.status(409).json({
          error: `Cannot re-submit audit report: application has already progressed to '${currentSub.status}'. Contact an admin if a correction is needed.`,
        });
      }

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
        ['AUDIT_REPORT_SUBMITTED', req.user.userId, req.params.id,
         `Status: ${newStatus}. Price: $${parseFloat(certifiedPrice).toFixed(4)}. Risk: ${riskRating}`]
      );

      // FIX 1.1 — notify issuer and admin that the audit report has been submitted
      try {
        const { sendMessage } = require('../utils/messenger');
        const { notifyIssuerAuditReportSubmitted } = require('../utils/mailer');
        const UUID_RE_AR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const recLabel = recommendation === 'APPROVE' ? 'APPROVE'
          : recommendation === 'REJECT' ? 'REJECT' : 'REQUEST CHANGES';

        if (currentSub.issuer_wallet) {
          await sendMessage({
            recipientId: currentSub.issuer_wallet,
            subject:     `📋 Audit Report Submitted — ${currentSub.token_symbol}`,
            body:        `Your auditor has submitted their review report for ${currentSub.token_symbol}. Recommendation: ${recLabel}. Certified price: $${parseFloat(certifiedPrice).toFixed(4)} per token. Admin will now conduct final review.`,
            type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
          }).catch(e => console.error('[MESSENGER] audit-report sendMessage (issuer) failed:', e.message));

          if (UUID_RE_AR.test(currentSub.issuer_wallet)) {
            const [arIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [currentSub.issuer_wallet]);
            if (arIssuerRows[0]?.email) {
              notifyIssuerAuditReportSubmitted({
                issuerEmail:    arIssuerRows[0].email,
                issuerName:     arIssuerRows[0].full_name,
                tokenSymbol:    currentSub.token_symbol,
                entityName:     currentSub.entity_name,
                recommendation: recLabel,
                certifiedPrice: parseFloat(certifiedPrice),
              }).catch(e => console.error('[MAILER] audit-report notifyIssuerAuditReportSubmitted failed:', e.message));
            }
          }
        }

        const [arAdminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
        if (arAdminRows.length > 0) {
          await sendMessage({
            recipientId: arAdminRows[0].id,
            subject:     `📋 Audit Report Ready — ${currentSub.token_symbol}`,
            body:        `Audit report received for ${currentSub.token_symbol} — ${currentSub.entity_name || currentSub.token_symbol}. Recommendation: ${recLabel}. Oracle price: $${parseFloat(certifiedPrice).toFixed(4)}. Ready for final approval.`,
            type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
          }).catch(e => console.error('[MESSENGER] audit-report sendMessage (admin) failed:', e.message));
        }
      } catch (notifyErr) {
        console.error('[AUDIT-REPORT] Notification error (non-fatal):', notifyErr.message);
      }

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
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
          sub.asset_type || 'EQUITY', sub.asset_type || 'EQUITY',
          UUID_RE.test(sub.issuer_wallet) ? sub.issuer_wallet : null,
          total_supply, certifiedPrice, certifiedPrice,
          parseFloat(certifiedPrice) * total_supply, trading_mode,
          listingType, sub.jurisdiction || 'Zimbabwe', req.params.id
        ]);
      }

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['ADMIN_FINAL_APPROVAL', req.user.userId, symbol,
         `Listing type: ${listingType}. Certified price: $${certifiedPrice}. Notes: ${adminNotes||'None'}. Status: TOKENIZATION_PENDING.`]
      );

      // Committee-stage notifications (application approval email, fee invoice, auditor assignment)
      // were already sent when admin approved the application at the committee meeting via
      // settings/applications/:id/approve. This route fires AFTER status=AUDITOR_APPROVED, so
      // only a "final approval" message is sent here to avoid duplicate emails to the issuer.
      const { getNumericSetting } = require('../utils/platformSettings');
      const { sendMessage } = require('../utils/messenger');

      const complianceFee = await getNumericSetting('compliance_fee_usd', 1500);
      const feeRef = `TEXZ-APP-${req.params.id}`;

      await db.execute(
        `INSERT INTO application_fees (submission_id, token_symbol, fee_type, amount_usd, reference, status)
         VALUES (?, ?, 'COMPLIANCE_REVIEW', ?, ?, 'PENDING')
         ON CONFLICT DO NOTHING`,
        [req.params.id, sub.token_symbol, complianceFee, feeRef]
      );

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `✅ Final Approval Granted — ${sub.token_symbol}`,
        body:        `Your tokenisation application for ${sub.entity_name} (${sub.token_symbol}) has been granted final admin approval following the auditor's review.\n\nToken status: TOKENIZATION_PENDING\nListing type: ${listingType === 'BROWNFIELD_BOURSE' ? 'Main Bourse (Brownfield)' : 'Peer-to-Peer (Greenfield)'}\nCertified price: $${certifiedPrice.toFixed(4)} per token\n\nNext step: Your application will be submitted to the Securities and Exchange Commission of Zimbabwe (SECZ) for regulatory approval. You will be notified when this is complete.\n\nReference: ${sub.reference_number}`,
        type:        'SYSTEM', category: 'APPLICATION', referenceId: String(req.params.id),
      }).catch(e => console.error('[MESSENGER] admin-approve final sendMessage (issuer) failed:', e.message));

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
    assetDescription, assetClass, financialEngineData,
  } = req.body;

  let parsedFinancialEngine = {};
  try { if (financialEngineData) parsedFinancialEngine = JSON.parse(financialEngineData); } catch { /* ignore */ }

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

    // Run valuation engine server-side if financial data was submitted
    let valuationResult = null;
    if (parsedFinancialEngine && Object.values(parsedFinancialEngine).some(v => v !== '' && v !== null && v !== undefined)) {
      try {
        const { calculateValuation } = require('../services/valuation');
        const finAssetType = (parsedFinancialEngine.assetType || assetType || 'EQUITY').toUpperCase();
        const valResult    = calculateValuation(finAssetType, { ...parsedFinancialEngine, sector });
        const totalDebtNum = Number(parsedFinancialEngine.totalDebt) || 0;
        const cashNum      = Number(parsedFinancialEngine.cash)      || 0;
        const equityValue  = valResult.blended - totalDebtNum + cashNum;
        const pricePerToken = shares > 0 ? equityValue / shares : 0;
        valuationResult = {
          assetType:    finAssetType,
          blended:      Math.round(valResult.blended),
          equityValue:  parseFloat(equityValue.toFixed(2)),
          pricePerToken: parseFloat(pricePerToken.toFixed(6)),
          issuedShares: shares,
          models:       valResult.models,
          generatedAt:  new Date().toISOString(),
        };
      } catch (e) {
        console.error('[VALUATION] Engine failed on submission:', e.message);
      }
    }

    const dataJson = JSON.stringify({
      financialData: { targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield, distributionFrequency, ...parsedFinancialEngine },
      valuationResult,
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

    // External email to issuer
    const [issuerEmailRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [req.user.userId]);
    if (issuerEmailRows.length > 0) {
      const { notifyIssuerApplicationReceived } = require('../utils/mailer');
      notifyIssuerApplicationReceived({
        issuerEmail: issuerEmailRows[0].email,
        issuerName:  issuerEmailRows[0].full_name || legalName,
        tokenSymbol: sym,
        entityName:  legalName,
        referenceNumber: refNum,
        meetingDay: 'Tuesday',
      }).catch(e => console.error('[MAILER] notifyIssuerApplicationReceived failed:', e.message));
    }

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

    // FIX 2.6 — send external email to issuer confirming auditor has accepted
    try {
      const { notifyIssuerAuditorAccepted } = require('../utils/mailer');
      const [aaIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      if (aaIssuerRows[0]?.email) {
        notifyIssuerAuditorAccepted({
          issuerEmail:     aaIssuerRows[0].email,
          issuerName:      aaIssuerRows[0].full_name,
          tokenSymbol:     sub.token_symbol,
          entityName:      sub.entity_name,
          referenceNumber: sub.reference_number,
        }).catch(e => console.error('[MAILER] auditor-accept notifyIssuerAuditorAccepted failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[AUDITOR-ACCEPT] Notification error (non-fatal):', notifyErr.message);
    }

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

    // FIX 3.5 — external emails to admin and issuer
    try {
      const mailer = require('../utils/mailer');

      // Fetch auditor email for admin notification
      const [adAuditorRows] = await db.execute('SELECT email FROM users WHERE id = ?', [req.user.userId]);
      mailer.notifyAdminAuditorDeclined({
        tokenSymbol:     sub.token_symbol,
        entityName:      sub.entity_name,
        auditorEmail:    adAuditorRows[0]?.email,
        declineReason:   reason,
        referenceNumber: sub.reference_number,
      }).catch(e => console.error('[MAILER] auditor-decline notifyAdminAuditorDeclined failed:', e.message));

      // External email to issuer — simple send() since the message is short and situational
      const [adIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      if (adIssuerRows[0]?.email) {
        const PLATFORM_URL = process.env.PLATFORM_URL || 'https://tokenequityx.co.zw';
        mailer.send(
          adIssuerRows[0].email,
          `⚠️ Auditor Update — ${sub.token_symbol}`,
          `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:-apple-system,sans-serif;background:#f4f4f5;padding:20px;"><div style="background:#fff;border-radius:12px;max-width:600px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);"><div style="background:#1A3C5E;padding:28px 32px;"><h1 style="color:#C8972B;font-size:22px;margin:0;font-weight:800;">TokenEquityX</h1></div><div style="padding:28px 32px;"><h2 style="color:#111827;font-size:18px;margin:0 0 16px;">Auditor Update — ${sub.token_symbol}</h2><p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${adIssuerRows[0].full_name},</p><p style="color:#374151;font-size:15px;line-height:1.6;">The auditor assigned to your tokenisation application for <strong>${sub.entity_name}</strong> (${sub.token_symbol}) was unavailable and could not accept the assignment.</p><p style="color:#374151;font-size:15px;line-height:1.6;">TokenEquityX is arranging a replacement auditor. <strong>No action is required from you</strong> at this time. You will be notified as soon as a new auditor is assigned.</p><p style="color:#6b7280;font-size:13px;">Reference: ${sub.reference_number}</p><a href="${PLATFORM_URL}/issuer" style="display:inline-block;background:#1A3C5E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px;">View Your Application &rarr;</a></div><div style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">TokenEquityX (Private) Limited &middot; This is an automated notification.</div></div></body></html>`
        ).catch(e => console.error('[MAILER] auditor-decline issuer email failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[AUDITOR-DECLINE] External email error (non-fatal):', notifyErr.message);
    }

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

    // FIX 3.6 — external email to issuer on suspension
    try {
      const { notifyIssuerApplicationSuspended } = require('../utils/mailer');
      const [sdIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      if (sdIssuerRows[0]?.email) {
        notifyIssuerApplicationSuspended({
          issuerEmail:     sdIssuerRows[0].email,
          issuerName:      sdIssuerRows[0].full_name,
          tokenSymbol:     sub.token_symbol,
          entityName:      sub.entity_name,
          reason,
          referenceNumber: sub.reference_number,
        }).catch(e => console.error('[MAILER] soft-delete notifyIssuerApplicationSuspended failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[SOFT-DELETE] External email error (non-fatal):', notifyErr.message);
    }

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

    // FIX 3.7 — external email to issuer on reinstatement
    try {
      const { notifyIssuerApplicationReinstated } = require('../utils/mailer');
      const [riIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.issuer_wallet]);
      if (riIssuerRows[0]?.email) {
        notifyIssuerApplicationReinstated({
          issuerEmail:     riIssuerRows[0].email,
          issuerName:      riIssuerRows[0].full_name,
          tokenSymbol:     sub.token_symbol,
          entityName:      sub.entity_name,
          referenceNumber: sub.reference_number,
        }).catch(e => console.error('[MAILER] reinstate notifyIssuerApplicationReinstated failed:', e.message));
      }
    } catch (notifyErr) {
      console.error('[REINSTATE] External email error (non-fatal):', notifyErr.message);
    }

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
        ['SECZ_REVIEW_SUBMITTED', req.user.userId, sub.token_symbol,
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
        ['SECZ_APPROVED', req.user.userId, sub.token_symbol,
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
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      // Always enter PRIMARY_ONLY on set-live; trading mode upgrades after the primary offering closes
      const trading_mode   = 'PRIMARY_ONLY';
      const total_supply   = sub.total_supply || 1000000;

      const [existingToken] = await db.execute(
        'SELECT id FROM tokens WHERE token_symbol = ?', [symbol.toUpperCase()]
      );

      if (existingToken.length > 0) {
        await db.execute(`
          UPDATE tokens
          SET trading_mode = 'PRIMARY_ONLY', market_state = 'PRIMARY_ONLY',
              status = 'ACTIVE', market_cap = ?, listed_at = NOW(), updated_at = NOW()
          WHERE token_symbol = ?
        `, [parseFloat(certifiedPrice) * total_supply, symbol.toUpperCase()]);
      } else {
        await db.execute(`
          INSERT INTO tokens
            (symbol, name, company_name, token_symbol, token_name,
             asset_type, asset_class, issuer_id,
             total_supply, current_price_usd, price_usd,
             market_cap, trading_mode, market_state, status,
             listing_type, jurisdiction, submission_id, listed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRIMARY_ONLY', 'ACTIVE', ?, ?, ?, NOW())
        `, [
          symbol.toUpperCase(), sub.entity_name || symbol, sub.entity_name || symbol,
          symbol.toUpperCase(), sub.entity_name || symbol,
          sub.asset_type || 'EQUITY', sub.asset_type || 'EQUITY',
          UUID_RE.test(sub.issuer_wallet) ? sub.issuer_wallet : null,
          total_supply, certifiedPrice, certifiedPrice,
          parseFloat(certifiedPrice) * total_supply, 'PRIMARY_ONLY',
          listingType, sub.jurisdiction || 'Zimbabwe', req.params.id
        ]);
      }

      await db.execute(
        "UPDATE data_submissions SET status = 'LIVE', updated_at = NOW() WHERE id = ?",
        [req.params.id]
      );

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['TOKEN_SET_LIVE', req.user.userId, symbol,
         `Token activated in PRIMARY_ONLY mode. Price: $${certifiedPrice}. Listing: ${listingType}. Full trading unlocks after primary offering closes.`]
      );

      const { sendMessage } = require('../utils/messenger');
      const { notifyIssuerTokenLive } = require('../utils/mailer');

      await sendMessage({
        recipientId: sub.issuer_wallet,
        subject:     `🚀 ${symbol} is Live — Create Your Primary Offering`,
        body:        `Congratulations! Your token ${sub.entity_name} (${symbol}) is now LIVE on the TokenEquityX platform in PRIMARY_ONLY mode.\n\nToken Price: $${certifiedPrice.toFixed(4)} USD\nListing Type: ${listingType === 'BROWNFIELD_BOURSE' ? 'Main Bourse (Brownfield)' : 'Peer-to-Peer (Greenfield)'}\nMarket State: PRIMARY ONLY\n\n📋 NEXT STEP — Create a Primary Offering:\nLog in to your issuer portal and go to the Primary Offering tab. Create your fundraising round to open subscriptions for investors.\n\nOnce your primary offering closes and proceeds are disbursed, your token will automatically move to ${listingType === 'BROWNFIELD_BOURSE' ? 'FULL TRADING on the main bourse' : 'P2P trading mode'}.\n\nFull secondary market trading does NOT begin until the primary offering closes.`,
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

// PUT /api/submissions/:id/amend — issuer amends an in-review submission
router.put('/:id/amend',
  authenticate,
  requireRole('ISSUER', 'ADMIN'),
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
    const AMEND_STATUSES = ['UNDER_REVIEW', 'INFO_REQUESTED', 'AUDITOR_ASSIGNED'];
    try {
      const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
      const sub = rows[0];

      if (req.user.role === 'ISSUER' && sub.issuer_wallet !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!AMEND_STATUSES.includes(sub.status) && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: `Submission cannot be amended at status: ${sub.status}. Allowed: ${AMEND_STATUSES.join(', ')}`,
        });
      }

      const {
        legalName, description, websiteUrl, foundedYear, headquarters,
        useOfProceeds, numEmployees, sector, assetType, assetClass, assetDescription,
        ceo_name, ceo_email, ceo_id, cfo_name, cfo_email, cfo_id,
        legal_name, legal_email, legal_id,
        targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield,
        distributionFrequency, authorisedShares, financialEngineData,
      } = req.body;

      let parsedFinancialEngine = {};
      try { if (financialEngineData) parsedFinancialEngine = JSON.parse(financialEngineData); } catch {}

      const supabase     = require('../utils/supabase');
      const sym          = sub.token_symbol;
      const existingData = typeof sub.data_json === 'string'
        ? JSON.parse(sub.data_json || '{}') : (sub.data_json || {});
      const uploadedDocs = { ...(existingData.documents || {}) };

      if (req.files) {
        for (const [docKey, fileArr] of Object.entries(req.files)) {
          const file     = fileArr[0];
          const filePath = `submissions/${sym}/${docKey}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
            uploadedDocs[docKey] = { name: file.originalname, url: urlData.publicUrl, path: filePath, size: file.size };
          } else {
            console.error(`[AMEND] Upload failed for ${docKey}:`, uploadError.message);
          }
        }
      }

      const shares        = parseInt(authorisedShares || parsedFinancialEngine.authorisedShares || 0)
                         || parseInt(existingData.financialData?.totalSupply || 0)
                         || 1000000;
      let valuationResult = existingData.valuationResult || null;

      const hasFinData = parsedFinancialEngine &&
        Object.values(parsedFinancialEngine).some(v => v !== '' && v !== null && v !== undefined);
      if (hasFinData) {
        try {
          const { calculateValuation } = require('../services/valuation');
          const finAssetType  = (parsedFinancialEngine.assetType || assetType || 'EQUITY').toUpperCase();
          const valResult     = calculateValuation(finAssetType, { ...parsedFinancialEngine, sector });
          const totalDebtNum  = Number(parsedFinancialEngine.totalDebt) || 0;
          const cashNum       = Number(parsedFinancialEngine.cash) || 0;
          const equityValue   = valResult.blended - totalDebtNum + cashNum;
          const pricePerToken = shares > 0 ? equityValue / shares : 0;
          valuationResult = {
            assetType:     finAssetType,
            blended:       Math.round(valResult.blended),
            equityValue:   parseFloat(equityValue.toFixed(2)),
            pricePerToken: parseFloat(pricePerToken.toFixed(6)),
            issuedShares:  shares,
            models:        valResult.models,
            generatedAt:   new Date().toISOString(),
          };
        } catch (e) {
          console.error('[VALUATION] Engine failed on amend:', e.message);
        }
      }

      const keyPersonnel = [
        { role: 'CEO',           name: ceo_name,   email: ceo_email,   idNumber: ceo_id },
        { role: 'CFO',           name: cfo_name,   email: cfo_email,   idNumber: cfo_id },
        { role: 'Legal Counsel', name: legal_name, email: legal_email, idNumber: legal_id },
      ].filter(p => p.name);

      const dataJson = JSON.stringify({
        ...existingData,
        financialData: {
          ...(existingData.financialData || {}),
          targetRaiseUsd, tokenIssuePrice, totalSupply, expectedYield, distributionFrequency,
          ...parsedFinancialEngine,
        },
        valuationResult,
        keyPersonnel:  keyPersonnel.length ? keyPersonnel : (existingData.keyPersonnel || []),
        sector:        sector        || existingData.sector,
        assetType:     assetType     || existingData.assetType,
        assetClass:    assetClass    || existingData.assetClass,
        description:   description   || assetDescription || existingData.description,
        websiteUrl:    websiteUrl    || existingData.websiteUrl,
        foundedYear:   foundedYear   || existingData.foundedYear,
        headquarters:  headquarters  || existingData.headquarters,
        useOfProceeds: useOfProceeds || existingData.useOfProceeds,
        numEmployees:  numEmployees  || existingData.numEmployees,
        documents:     uploadedDocs,
        amendedAt:     new Date().toISOString(),
      });

      await db.execute(`
        UPDATE data_submissions
        SET entity_name    = COALESCE(?, entity_name),
            data_json      = ?,
            document_count = ?,
            updated_at     = NOW()
        WHERE id = ?
      `, [legalName || null, dataJson, Object.keys(uploadedDocs).length, req.params.id]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['SUBMISSION_AMENDED', req.user.userId, sym,
         `Amendment submitted. Status remains: ${sub.status}. Ref: ${sub.reference_number}`]
      );

      const { sendMessage } = require('../utils/messenger');
      const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRows.length > 0) {
        await sendMessage({
          recipientId: adminRows[0].id,
          subject:     `✏️ Submission Amended — ${sym}`,
          body:        `Issuer has amended submission ${sub.reference_number} for ${sub.entity_name} (${sym}). Please review the updated documents.\n\nStatus: ${sub.status}\nReference: ${sub.reference_number}`,
          type:        'SYSTEM',
          category:    'APPLICATION',
          referenceId: sub.reference_number,
        }).catch(e => console.error('[MESSENGER] amend sendMessage (admin) failed:', e.message));
      }

      res.json({
        success:     true,
        tokenSymbol: sym,
        message:     `Amendment for ${sym} submitted. The compliance team will review your changes.`,
      });
    } catch (err) {
      res.status(500).json({ error: 'Amendment failed: ' + err.message });
    }
  }
);

// DELETE /api/submissions/:id/withdraw — issuer withdraws their UNDER_REVIEW or INFO_REQUESTED submission
router.delete('/:id/withdraw', authenticate, requireRole('ISSUER', 'ADMIN'), async (req, res) => {
  const WITHDRAW_STATUSES = ['UNDER_REVIEW', 'INFO_REQUESTED'];
  try {
    const [rows] = await db.execute('SELECT * FROM data_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const sub = rows[0];

    if (req.user.role !== 'ADMIN' && sub.issuer_wallet !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role !== 'ADMIN' && !WITHDRAW_STATUSES.includes(sub.status)) {
      return res.status(403).json({
        error: `Cannot withdraw a submission with status: ${sub.status}. Only UNDER_REVIEW or INFO_REQUESTED submissions can be withdrawn.`,
      });
    }

    await db.execute('DELETE FROM data_submissions WHERE id = ?', [req.params.id]);
    await db.execute('DELETE FROM application_fees WHERE token_symbol = ?', [sub.token_symbol]).catch(() => {});

    await db.execute(
      'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
      ['SUBMISSION_WITHDRAWN', req.user.userId, sub.token_symbol,
       `Issuer withdrew application ${sub.reference_number} for ${sub.entity_name}. Previous status: ${sub.status}`]
    );

    const { sendMessage } = require('../utils/messenger');
    const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     `🗑️ Application Withdrawn — ${sub.token_symbol}`,
        body:        `Issuer has withdrawn application ${sub.reference_number} for ${sub.entity_name} (${sub.token_symbol}).\n\nPrevious status: ${sub.status}`,
        type:        'SYSTEM',
        category:    'APPLICATION',
        referenceId: sub.reference_number,
      }).catch(e => console.error('[MESSENGER] withdraw sendMessage (admin) failed:', e.message));
    }

    res.json({ success: true, message: `Application for ${sub.token_symbol} withdrawn successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Withdrawal failed: ' + err.message });
  }
});

module.exports = router;