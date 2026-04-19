// api/src/routes/submissions.js
const router  = require('express').Router();
const db      = require('../db/pool');
const logger  = require('../utils/logger');
const upload  = require('../middleware/upload');
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

      const uploadedDocs = req.files ? req.files.map(f => ({
        originalName: f.originalname,
        storedName:   f.filename,
        path:         f.path,
        size:         f.size,
        mimetype:     f.mimetype,
        url:          `/uploads/financials/${f.filename}`,
      })) : [];

      const dataJson = JSON.stringify({
        revenue:                  revenue || null,
        ebitda:                   ebitda || null,
        netAssets:                netAssets || null,
        netLiabilities:           netLiabilities || null,
        operationalKpis:          operationalKpis ? JSON.parse(operationalKpis) : {},
        managementStatement:      managementStatement || null,
        distributionAnnouncement: distributionAnnouncement || null,
        documents:                uploadedDocs,
        submittedAt:              new Date().toISOString(),
      });

      const tokenId = tokens.length > 0 ? tokens[0].id : null;

      await db.execute(`
        INSERT INTO data_submissions
          (id, token_id, token_symbol, issuer_wallet, period, data_json, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
      `, [subId, tokenId, tokenSymbol.toUpperCase(), req.user.userId, period, dataJson]);

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
        documents:         uploadedDocs.map(d => ({ name: d.originalName, url: d.url })),
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
        documents:         uploadedDocs.map(d => ({ name: d.originalName, url: d.url })),
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
                 ds.reference_number, ds.submission_type
          FROM data_submissions ds
          WHERE ds.status NOT IN ('APPROVED', 'REJECTED')
          ORDER BY ds.created_at ASC
        `);
      } else {
        const auditorId     = req.user.userId;
        const auditorWallet = req.user.wallet || '';
        [rows] = await db.execute(`
          SELECT ds.id, ds.token_symbol, ds.status,
                 ds.created_at, ds.auditor_notes, ds.updated_at as reviewed_at,
                 ds.issuer_wallet, ds.assigned_auditor,
                 ds.entity_name, ds.reference_number, ds.submission_type
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
      await db.execute(`
        UPDATE data_submissions
        SET assigned_auditor = ?, status = 'UNDER_REVIEW',
            auditor_notes = COALESCE(auditor_notes,'') || ' | Assigned to: ' || ?
        WHERE id = ?
      `, [assignedAuditor, assignedAuditor, req.params.id]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['AUDITOR_ASSIGNED', req.user.wallet || req.user.userId, req.params.id,
         `Assigned to: ${assignedAuditor}`]
      );

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
    const valid = ['APPROVED','REJECTED','UNDER_REVIEW','INFO_REQUESTED','AUDITOR_APPROVED','ADMIN_APPROVED'];
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

      const sub            = rows[0];
      const auditReport    = sub.audit_report ? JSON.parse(sub.audit_report) : {};
      const certifiedPrice = auditReport.certifiedPrice || 1.0;
      const symbol         = tokenSymbol || sub.token_symbol;
      const trading_mode   = listingType === 'GREENFIELD_P2P' ? 'P2P_ONLY' : 'FULL_TRADING';
      const total_supply   = sub.total_supply || 1000000;

      await db.execute(`
        UPDATE data_submissions
        SET status = 'ADMIN_APPROVED', listing_type = ?,
            admin_approved_by = ?, admin_approved_at = NOW(), admin_notes = ?
        WHERE id = ?
      `, [listingType, req.user.userId, adminNotes || null, req.params.id]);

      const [existingToken] = await db.execute(
        'SELECT id FROM tokens WHERE token_symbol = ?', [symbol.toUpperCase()]
      );

      if (existingToken.length > 0) {
        await db.execute(`
          UPDATE tokens
          SET listing_type = ?, current_price_usd = ?,
              trading_mode = ?, market_state = 'FULL_TRADING',
              status = 'ACTIVE', market_cap = ?, listed_at = NOW(), updated_at = NOW()
          WHERE token_symbol = ?
        `, [listingType, certifiedPrice, trading_mode,
            parseFloat(certifiedPrice) * total_supply, symbol.toUpperCase()]);
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
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['ADMIN_FINAL_APPROVAL', req.user.wallet || req.user.userId, symbol,
         `Listing type: ${listingType}. Certified price: $${certifiedPrice}. Notes: ${adminNotes||'None'}`]
      );

      res.json({
        success: true, listingType, certifiedPrice, symbol: symbol.toUpperCase(),
        message: `${symbol.toUpperCase()} approved for ${listingType === 'BROWNFIELD_BOURSE' ? 'Main Bourse' : 'Peer-to-Peer trading'}. Ready for token minting.`,
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

module.exports = router;