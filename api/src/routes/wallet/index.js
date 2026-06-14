// api/src/routes/wallet/index.js
// ═══════════════════════════════════════════════════════════════════════════
// WALLET API — TokenEquityX V3
// ═══════════════════════════════════════════════════════════════════════════
//
// FIAT (USD) ENDPOINTS
//   GET  /api/wallet/balance              Investor wallet balances (USD + USDC)
//   POST /api/wallet/deposit              Submit fiat deposit request (reference number)
//   GET  /api/wallet/deposits             Investor's fiat deposit history
//   POST /api/wallet/withdraw             Submit fiat withdrawal request
//   GET  /api/wallet/withdrawals          Investor's fiat withdrawal history
//
// USDC SUPERVISED PILOT ENDPOINTS (SI 99 of 2026)
//   Requires: usdc_pilot_enabled = true in platform_settings
//   GET  /api/wallet/usdc/balance         Investor's USDC balance (Polygon PoS)
//   POST /api/wallet/usdc/deposit         Submit USDC deposit intent + on-chain tx hash
//   POST /api/wallet/usdc/withdraw        Request USDC withdrawal; IMTT withheld for ZW residents
//
// ADMIN ENDPOINTS (ADMIN role required)
//   GET  /api/wallet/admin/deposits       All deposit requests (paginated, filterable)
//   POST /api/wallet/admin/confirm/:id    Confirm a fiat deposit (credit USD balance)
//   POST /api/wallet/admin/reject/:id     Reject a deposit request
//   GET  /api/wallet/admin/withdrawals    All withdrawal requests
//   POST /api/wallet/admin/process/:id    Mark withdrawal as PROCESSING
//   POST /api/wallet/admin/complete/:id   Complete withdrawal (debit USD balance)
//   POST /api/wallet/admin/reject-withdrawal/:id  Reject a withdrawal
//   GET  /api/wallet/admin/transactions   All wallet transactions (paginated, type filter)
//
// NOTES
//   - All amounts are in USD or USDC; never mixed in one request.
//   - IMTT on USDC withdrawals applies to Zimbabwe residents only
//     (country_of_residence='ZW' or nationality='ZW' in approved KYC record).
//   - USDC contract: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 (Polygon PoS)
//   - Kill switch: set usdc_pilot_enabled='false' in platform_settings to
//     disable all USDC endpoints instantly (HTTP 503 returned to caller).
// ═══════════════════════════════════════════════════════════════════════════

const router  = require('express').Router();
const db      = require('../../db/pool');
const { authenticate }      = require('../../middleware/auth');
const { requireRole }       = require('../../middleware/roles');
const { v4: uuidv4 }        = require('uuid');
const mailer                = require('../../utils/mailer');
const { sendMessage }       = require('../../utils/messenger');
const { getNumericSetting }           = require('../../utils/platformSettings');
const { createSettlementInstruction } = require('../../utils/settlement');

// ════════════════════════════════════════════════════════
// INVESTOR — BALANCE
// ════════════════════════════════════════════════════════

// GET /api/wallet/balance — investor's wallet balances
router.get('/balance', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    if (rows.length === 0) {
      // Auto-create wallet if missing
      await db.execute(
        `INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd, settlement_rail)
         VALUES (gen_random_uuid(), ?, 0, 0, 0, 'FIAT')`,
        [req.user.userId]
      );
      return res.json({ balance_usd: 0, balance_usdc: 0, reserved_usd: 0, available_usd: 0, settlement_rail: 'FIAT' });
    }
    const w = rows[0];
    res.json({
      balance_usd:    parseFloat(w.balance_usd   || 0),
      balance_usdc:   parseFloat(w.balance_usdc  || 0),
      reserved_usd:   parseFloat(w.reserved_usd  || 0),
      available_usd:  parseFloat((parseFloat(w.balance_usd||0) - parseFloat(w.reserved_usd||0)).toFixed(2)),
      settlement_rail: w.settlement_rail || 'FIAT',
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch balance: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════
// INVESTOR — DEPOSITS
// ════════════════════════════════════════════════════════

// POST /api/wallet/deposit — investor submits a deposit request
router.post('/deposit', authenticate, async (req, res) => {
  const { amount_usd, reference, notes } = req.body;
  if (!amount_usd || !reference) {
    return res.status(400).json({ error: 'amount_usd and reference are required' });
  }
  if (parseFloat(amount_usd) < 100) {
    return res.status(400).json({ error: 'Minimum deposit is USD 100' });
  }

  try {
    // Check reference not already used
    const [existing] = await db.execute(
      "SELECT id FROM deposit_requests WHERE reference = ? AND status != 'REJECTED'",
      [reference]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'This reference number has already been submitted' });
    }

    const depositId = uuidv4();
    await db.execute(
      `INSERT INTO deposit_requests (id, user_id, amount_usd, reference, notes, status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [depositId, req.user.userId, amount_usd, reference.trim().toUpperCase(), notes || null]
    );

    // Get investor details for email
    const [users] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [req.user.userId]
    );
    const investor = users[0] || {};

    // Email admin
    mailer.notifyAdminDepositSubmitted({
      investorName:  investor.full_name || 'Investor',
      investorEmail: investor.email     || '',
      amount:        amount_usd,
      reference:     reference.trim().toUpperCase(),
      depositId,
    }).catch(e => console.error('[MAILER] notifyAdminDepositSubmitted failed:', e.message));

    // Email investor with bank transfer instructions
    if (investor.email) {
      mailer.notifyInvestorDepositInstructions({
        investorEmail: investor.email,
        investorName:  investor.full_name || 'Investor',
        amount:        amount_usd,
        reference:     reference.trim().toUpperCase(),
        depositId,
      }).catch(e => console.error('[MAILER] notifyInvestorDepositInstructions failed:', e.message));
    }

    // Platform message to investor confirming submission received
    sendMessage({
      recipientId: req.user.userId,
      subject:     `💰 Deposit Request Received — $${parseFloat(amount_usd).toFixed(2)} USD`,
      body:        `Your deposit request of $${parseFloat(amount_usd).toFixed(2)} USD has been received.\n\nReference: ${reference.trim().toUpperCase()}\nDeposit ID: ${depositId}\n\nAdmin will verify and confirm once the bank transfer is cleared. This typically takes 1-2 business days. You will receive a notification once your deposit is confirmed.`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: depositId,
    }).catch(e => console.error('[MESSENGER] deposit POST sendMessage (investor) failed:', e.message));

    // Platform message to admin system inbox
    sendMessage({
      recipientId: '00000000-0000-0000-0000-000000000001',
      subject:     `💰 New Deposit Request — $${parseFloat(amount_usd).toFixed(2)} from ${investor.full_name || 'Investor'}`,
      body:        `New deposit request submitted.\n\nAmount: $${parseFloat(amount_usd).toFixed(2)} USD\nInvestor: ${investor.full_name || 'Unknown'} (${investor.email || ''})\nReference: ${reference.trim().toUpperCase()}\nDeposit ID: ${depositId}\n\nVerify the credit on Stanbic before confirming.`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: depositId,
    }).catch(e => console.error('[MESSENGER] deposit POST sendMessage (admin) failed:', e.message));

    res.json({
      success:   true,
      depositId,
      status:    'PENDING',
      message:   'Deposit request submitted. Admin will confirm once the transfer is verified on the Stanbic account. This typically takes 1-4 business hours.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit deposit: ' + err.message });
  }
});

// GET /api/wallet/deposits — investor's own deposit history
router.get('/deposits', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch deposits' });
  }
});

// ════════════════════════════════════════════════════════
// INVESTOR — WITHDRAWALS
// ════════════════════════════════════════════════════════

// POST /api/wallet/withdraw — investor submits a withdrawal request
router.post('/withdraw', authenticate, async (req, res) => {
  const { amount_usd, bank_name, account_name, account_number, branch_code, notes } = req.body;
  if (!amount_usd || !bank_name || !account_name || !account_number) {
    return res.status(400).json({ error: 'amount_usd, bank_name, account_name and account_number are required' });
  }
  if (parseFloat(amount_usd) < 50) {
    return res.status(400).json({ error: 'Minimum withdrawal is USD 50' });
  }

  const imttRate      = await getNumericSetting('imtt_rate', 0.02);
  const imttAmount    = parseFloat((parseFloat(amount_usd) * imttRate).toFixed(2));
  const totalRequired = parseFloat((parseFloat(amount_usd) + imttAmount).toFixed(2));

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check available balance (must cover withdrawal + IMTT)
    const [wallets] = await conn.execute(
      'SELECT * FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    if (wallets.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No wallet found' });
    }
    const wallet = wallets[0];
    const available = parseFloat(wallet.balance_usd) - parseFloat(wallet.reserved_usd);
    if (available < totalRequired) {
      await conn.rollback();
      return res.status(400).json({
        error: `Insufficient available balance. Available: $${available.toFixed(2)}, Required: $${totalRequired.toFixed(2)} (withdrawal $${parseFloat(amount_usd).toFixed(2)} + IMTT $${imttAmount.toFixed(2)})`
      });
    }

    const withdrawalId = uuidv4();

    // Deduct IMTT immediately; reserve withdrawal amount for pending processing
    await conn.execute(
      'UPDATE investor_wallets SET balance_usd = balance_usd - ?, reserved_usd = reserved_usd + ?, updated_at = NOW() WHERE user_id = ?',
      [imttAmount, amount_usd, req.user.userId]
    );

    await conn.execute(`
      INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
      VALUES (gen_random_uuid(), ?, 'IMTT', ?, ?, ?, ?, ?)
    `, [
      req.user.userId, -imttAmount,
      parseFloat(wallet.balance_usd),
      parseFloat((parseFloat(wallet.balance_usd) - imttAmount).toFixed(2)),
      withdrawalId,
      `IMTT 2% on $${parseFloat(amount_usd).toFixed(2)} withdrawal`,
    ]);

    await conn.execute(
      `INSERT INTO withdrawal_requests
         (id, user_id, amount_usd, bank_name, account_name, account_number, branch_code, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [withdrawalId, req.user.userId, amount_usd, bank_name, account_name, account_number, branch_code || null, notes || null]
    );

    await conn.execute(
      'UPDATE platform_treasury SET usd_liability = usd_liability + ?, updated_at = NOW() WHERE id = 1',
      [imttAmount]
    );

    await conn.commit();

    // Get investor details for email
    const [users] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?', [req.user.userId]
    );
    const investor = users[0] || {};

    // Email admin
    mailer.notifyAdminWithdrawalSubmitted({
      investorName:  investor.full_name  || 'Investor',
      investorEmail: investor.email      || '',
      amount:        amount_usd,
      bankName:      bank_name,
      accountName:   account_name,
      accountNumber: account_number,
      withdrawalId,
    }).catch(e => console.error('[MAILER] notifyAdminWithdrawalSubmitted failed:', e.message));

    // Email investor
    mailer.notifyInvestorWithdrawalProcessing({
      investorEmail: investor.email     || '',
      investorName:  investor.full_name || 'Investor',
      amount:        amount_usd,
      bankName:      bank_name,
      accountNumber: account_number,
    }).catch(e => console.error('[MAILER] notifyInvestorWithdrawalProcessing failed:', e.message));

    // FIX 3.4 — platform message to investor
    sendMessage({
      recipientId: req.user.userId,
      subject:     `💸 Withdrawal Request Submitted — $${parseFloat(amount_usd).toFixed(2)} USD`,
      body:        `Your withdrawal request of $${parseFloat(amount_usd).toFixed(2)} USD has been submitted.\n\nBank: ${bank_name}\nAccount: ${account_number}\n\nWe will process your EFT/RTGS transfer within 2-3 business days. You will be notified when the transfer is complete.\n\nWithdrawal ID: ${withdrawalId}`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: withdrawalId,
    }).catch(e => console.error('[MESSENGER] withdraw POST sendMessage (investor) failed:', e.message));

    // FIX 3.4 — platform message to admin (system UUID)
    sendMessage({
      recipientId: '00000000-0000-0000-0000-000000000001',
      subject:     `💸 New Withdrawal Request — $${parseFloat(amount_usd).toFixed(2)} from ${investor.full_name || 'Investor'}`,
      body:        `New withdrawal request received.\n\nAmount: $${parseFloat(amount_usd).toFixed(2)} USD\nInvestor: ${investor.full_name || 'Unknown'} (${investor.email || ''})\nBank: ${bank_name}\nAccount Name: ${account_name}\nAccount Number: ${account_number}\n\nRequires processing. Withdrawal ID: ${withdrawalId}`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: withdrawalId,
    }).catch(e => console.error('[MESSENGER] withdraw POST sendMessage (admin) failed:', e.message));

    res.json({
      success:      true,
      withdrawalId,
      status:       'PENDING',
      message:      'Withdrawal request submitted. Funds will be transferred within 2 business days. You will receive an email confirmation when the transfer is complete.',
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Could not submit withdrawal: ' + err.message });
  } finally {
    conn.release();
  }
});

// GET /api/wallet/withdrawals — investor's own withdrawal history
router.get('/withdrawals', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch withdrawals' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN — DEPOSIT MANAGEMENT
// ════════════════════════════════════════════════════════

// GET /api/wallet/admin/deposits — all deposits for admin
router.get('/admin/deposits',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          dr.*,
          u.full_name, u.email,
          iw.balance_usd AS current_balance
        FROM deposit_requests dr
        JOIN users u ON u.id = dr.user_id
        LEFT JOIN investor_wallets iw ON iw.user_id = dr.user_id
        ORDER BY
          CASE dr.status WHEN 'PENDING' THEN 0 ELSE 1 END,
          dr.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch deposits: ' + err.message });
    }
  }
);

// PUT /api/wallet/deposit/:id/confirm — admin confirms a deposit
router.put('/deposit/:id/confirm',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { admin_notes } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT dr.*, u.full_name, u.email FROM deposit_requests dr JOIN users u ON u.id = dr.user_id WHERE dr.id = ?',
        [req.params.id]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Deposit request not found' });
      }
      const dep = rows[0];
      if (dep.status !== 'PENDING') {
        await conn.rollback();
        return res.status(400).json({ error: `Deposit is already ${dep.status}` });
      }

      // Credit investor wallet
      const [wallets] = await conn.execute(
        'SELECT * FROM investor_wallets WHERE user_id = ?', [dep.user_id]
      );
      const currentBal = wallets.length > 0 ? parseFloat(wallets[0].balance_usd) : 0;
      const newBal     = parseFloat((currentBal + parseFloat(dep.amount_usd)).toFixed(2));

      if (wallets.length === 0) {
        await conn.execute(
          `INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd)
           VALUES (gen_random_uuid(), ?, ?, 0, 0)`,
          [dep.user_id, newBal]
        );
      } else {
        await conn.execute(
          'UPDATE investor_wallets SET balance_usd = ?, updated_at = NOW() WHERE user_id = ?',
          [newBal, dep.user_id]
        );
      }

      // Wallet transaction record
      await conn.execute(
        `INSERT INTO wallet_transactions
           (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
         VALUES (gen_random_uuid(), ?, 'DEPOSIT', ?, ?, ?, ?, ?)`,
        [dep.user_id, parseFloat(dep.amount_usd), currentBal, newBal, dep.id,
         `Deposit confirmed — Ref: ${dep.reference}`]
      );

      // Update deposit status
      await conn.execute(
        `UPDATE deposit_requests SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW(), notes = ? WHERE id = ?`,
        [req.user.userId, admin_notes || dep.notes, req.params.id]
      );

      // F-03: settlement instruction so banking partner can reconcile incoming RTGS/EFT
      await createSettlementInstruction(conn, {
        type:            'DEPOSIT',
        from_user_id:    null,
        to_user_id:      dep.user_id,
        gross_amount:    dep.amount_usd,
        fee_amount:      0,
        net_amount:      dep.amount_usd,
        settlement_rail: 'FIAT',
        reference:       dep.reference || dep.id,
      });

      await conn.commit();

      // Email investor
      mailer.notifyInvestorDepositConfirmed({
        investorEmail: dep.email,
        investorName:  dep.full_name,
        amount:        dep.amount_usd,
        reference:     dep.reference,
      }).catch(e => console.error('[MAILER] notifyInvestorDepositConfirmed failed:', e.message));

      await sendMessage({
        recipientId: dep.user_id,
        subject:     `✅ Deposit Confirmed — $${parseFloat(dep.amount_usd).toFixed(2)} USD`,
        body:        `Your deposit of $${parseFloat(dep.amount_usd).toFixed(2)} USD has been verified and credited to your wallet. Reference: ${dep.reference}. Your updated wallet balance is $${newBal.toFixed(2)} USD.`,
        type:        'SYSTEM',
        category:    'WALLET',
        referenceId: String(req.params.id),
      }).catch(() => {});

      // Push webhook to banking partner
      const { notifyDepositReceived } = require('../../services/webhook');
      notifyDepositReceived({
        investorId:    dep.user_id,
        investorEmail: dep.email || '',
        amount:        dep.amount_usd,
        reference:     dep.reference || dep.id,
      }).catch(() => {});

      res.json({
        success:    true,
        newBalance: newBal,
        message:    `✅ $${dep.amount_usd} deposit confirmed for ${dep.full_name}. Wallet balance updated to $${newBal}.`,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not confirm deposit: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// PUT /api/wallet/deposit/:id/reject — admin rejects a deposit
router.put('/deposit/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { reason } = req.body;
    try {
      const [rows] = await db.execute(
        'SELECT dr.*, u.full_name, u.email FROM deposit_requests dr JOIN users u ON u.id = dr.user_id WHERE dr.id = ?',
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Deposit not found' });
      const dep = rows[0];
      if (dep.status !== 'PENDING') return res.status(400).json({ error: `Deposit is already ${dep.status}` });

      await db.execute(
        "UPDATE deposit_requests SET status = 'REJECTED', confirmed_by = ?, confirmed_at = NOW(), notes = ? WHERE id = ?",
        [req.user.userId, reason || 'Reference not verified', req.params.id]
      );

      // Email investor
      mailer.notifyInvestorDepositRejected({
        investorEmail: dep.email,
        investorName:  dep.full_name,
        amount:        dep.amount_usd,
        reference:     dep.reference,
        reason:        reason || 'Reference could not be verified on the Stanbic account',
      }).catch(e => console.error('[MAILER] notifyInvestorDepositRejected failed:', e.message));

      // FIX 3.9 — platform message to investor on deposit rejection
      sendMessage({
        recipientId: dep.user_id,
        subject:     `❌ Deposit Not Verified — $${parseFloat(dep.amount_usd).toFixed(2)} USD`,
        body:        `Your deposit request of $${parseFloat(dep.amount_usd).toFixed(2)} USD (Ref: ${dep.reference}) has been rejected.\n\nReason: ${reason || 'Reference could not be verified on the Stanbic account'}\n\nPlease contact admin@tokenequityx.co.zw if you believe this is an error.`,
        type:        'SYSTEM',
        category:    'WALLET',
        referenceId: String(req.params.id),
      }).catch(e => console.error('[MESSENGER] deposit reject sendMessage (investor) failed:', e.message));

      res.json({ success: true, message: `Deposit rejected. ${dep.full_name} has been notified by email.` });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject deposit: ' + err.message });
    }
  }
);

// ════════════════════════════════════════════════════════
// ADMIN — WITHDRAWAL MANAGEMENT
// ════════════════════════════════════════════════════════

// GET /api/wallet/admin/withdrawals — all withdrawals for admin
router.get('/admin/withdrawals',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          wr.*,
          u.full_name, u.email,
          iw.balance_usd AS current_balance
        FROM withdrawal_requests wr
        JOIN users u ON u.id = wr.user_id
        LEFT JOIN investor_wallets iw ON iw.user_id = wr.user_id
        ORDER BY
          CASE wr.status WHEN 'PENDING' THEN 0 WHEN 'PROCESSING' THEN 1 ELSE 2 END,
          wr.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch withdrawals: ' + err.message });
    }
  }
);

// PUT /api/wallet/withdraw/:id/complete — admin marks withdrawal complete
router.put('/withdraw/:id/complete',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { tx_reference, admin_notes } = req.body;
    if (!tx_reference) {
      return res.status(400).json({ error: 'Bank transfer reference number is required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT wr.*, u.full_name, u.email FROM withdrawal_requests wr JOIN users u ON u.id = wr.user_id WHERE wr.id = ?',
        [req.params.id]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Withdrawal not found' });
      }
      const wr = rows[0];
      if (wr.status === 'COMPLETED') {
        await conn.rollback();
        return res.status(400).json({ error: 'Withdrawal already completed' });
      }

      // Debit investor wallet (remove from balance and reserved)
      const [wallets] = await conn.execute(
        'SELECT * FROM investor_wallets WHERE user_id = ?', [wr.user_id]
      );
      if (wallets.length > 0) {
        const currentBal = parseFloat(wallets[0].balance_usd);
        const currentRes = parseFloat(wallets[0].reserved_usd);
        const newBal     = parseFloat((currentBal - parseFloat(wr.amount_usd)).toFixed(2));
        const newRes     = parseFloat(Math.max(0, currentRes - parseFloat(wr.amount_usd)).toFixed(2));

        await conn.execute(
          'UPDATE investor_wallets SET balance_usd = ?, reserved_usd = ?, updated_at = NOW() WHERE user_id = ?',
          [newBal, newRes, wr.user_id]
        );

        await conn.execute(
          `INSERT INTO wallet_transactions
             (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
           VALUES (gen_random_uuid(), ?, 'WITHDRAWAL', ?, ?, ?, ?, ?)`,
          [wr.user_id, -parseFloat(wr.amount_usd), currentBal, newBal, wr.id,
           `Withdrawal completed — Bank ref: ${tx_reference} — ${wr.bank_name}`]
        );
      }

      await conn.execute(
        `UPDATE withdrawal_requests SET
           status = 'COMPLETED', processed_by = ?, processed_at = NOW(),
           tx_reference = ?, notes = ?
         WHERE id = ?`,
        [req.user.userId, tx_reference, admin_notes || wr.notes, req.params.id]
      );

      // F-03: settlement instruction for banking partner records
      const imttRate = await getNumericSetting('imtt_rate', 0.02);
      const imttAmt  = parseFloat((parseFloat(wr.amount_usd) * imttRate).toFixed(2));
      await createSettlementInstruction(conn, {
        type:            'WITHDRAWAL',
        from_user_id:    wr.user_id,
        to_user_id:      null,
        gross_amount:    wr.amount_usd,
        fee_amount:      imttAmt,
        net_amount:      parseFloat(wr.amount_usd) - imttAmt,
        settlement_rail: 'FIAT',
        reference:       tx_reference,
      });

      await conn.commit();

      // Email investor
      mailer.notifyInvestorWithdrawalCompleted({
        investorEmail: wr.email,
        investorName:  wr.full_name,
        amount:        wr.amount_usd,
        bankName:      wr.bank_name,
        accountNumber: wr.account_number,
        txReference:   tx_reference,
      }).catch(e => console.error('[MAILER] notifyInvestorWithdrawalCompleted failed:', e.message));

      await sendMessage({
        recipientId: wr.user_id,
        subject:     `✅ Withdrawal Completed — $${parseFloat(wr.amount_usd).toFixed(2)} USD`,
        body:        `Your withdrawal of $${parseFloat(wr.amount_usd).toFixed(2)} USD has been processed and sent to your bank account at ${wr.bank_name || 'your bank'}. Bank reference: ${tx_reference || 'N/A'}.`,
        type:        'SYSTEM',
        category:    'WALLET',
        referenceId: String(req.params.id),
      }).catch(() => {});

      res.json({
        success: true,
        message: `✅ $${wr.amount_usd} withdrawal completed for ${wr.full_name}. Bank ref: ${tx_reference}. Investor notified by email.`,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not complete withdrawal: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// PUT /api/wallet/withdraw/:id/reject — admin rejects a withdrawal
router.put('/withdraw/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { reason } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT wr.*, u.full_name, u.email FROM withdrawal_requests wr JOIN users u ON u.id = wr.user_id WHERE wr.id = ?',
        [req.params.id]
      );
      if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Withdrawal not found' }); }
      const wr = rows[0];
      if (wr.status === 'COMPLETED') { await conn.rollback(); return res.status(400).json({ error: 'Cannot reject a completed withdrawal' }); }
      if (wr.status === 'REJECTED')  { await conn.rollback(); return res.status(400).json({ error: 'Withdrawal already rejected' }); }

      // Look up the IMTT that was deducted at submission time.
      // We read the actual ledger entry rather than recomputing, in case the rate changed.
      const [imttRows] = await conn.execute(
        "SELECT ABS(amount_usd) AS imtt_amount FROM wallet_transactions WHERE reference_id = ? AND user_id = ? AND description LIKE 'IMTT%' LIMIT 1",
        [req.params.id, wr.user_id]
      );
      const imttAmount = parseFloat(imttRows[0]?.imtt_amount || 0);

      // Release reserved amount AND refund IMTT back to balance
      await conn.execute(
        'UPDATE investor_wallets SET balance_usd = balance_usd + ?, reserved_usd = GREATEST(0, reserved_usd - ?), updated_at = NOW() WHERE user_id = ?',
        [imttAmount, wr.amount_usd, wr.user_id]
      );

      // Record IMTT refund in the ledger for full auditability
      if (imttAmount > 0) {
        const [wRows] = await conn.execute('SELECT balance_usd FROM investor_wallets WHERE user_id = ?', [wr.user_id]);
        const balanceAfter = parseFloat(wRows[0]?.balance_usd || 0);
        await conn.execute(
          `INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
           VALUES (gen_random_uuid(), ?, 'REFUND', ?, ?, ?, ?, ?)`,
          [
            wr.user_id,
            imttAmount,
            parseFloat((balanceAfter - imttAmount).toFixed(2)),
            balanceAfter,
            req.params.id,
            `IMTT refund — withdrawal rejected`,
          ]
        );

        // Reverse the IMTT that was credited to platform treasury at submission
        await conn.execute(
          'UPDATE platform_treasury SET usd_liability = GREATEST(0, usd_liability - ?), updated_at = NOW() WHERE id = 1',
          [imttAmount]
        );
      }

      await conn.execute(
        "UPDATE withdrawal_requests SET status = 'REJECTED', processed_by = ?, processed_at = NOW(), notes = ? WHERE id = ?",
        [req.user.userId, reason || 'Rejected by admin', req.params.id]
      );

      await conn.commit();

      const imttNote = imttAmount > 0 ? ` IMTT of $${imttAmount.toFixed(2)} has been refunded to your balance.` : '';

      // Email investor
      mailer.notifyInvestorWithdrawalRejected({
        investorEmail: wr.email,
        investorName:  wr.full_name,
        amount:        wr.amount_usd,
        reason:        reason || 'Please contact support for details',
      }).catch(e => console.error('[MAILER] notifyInvestorWithdrawalRejected failed:', e.message));

      await sendMessage({
        recipientId: wr.user_id,
        subject:     `❌ Withdrawal Request Rejected`,
        body:        `Your withdrawal request of $${parseFloat(wr.amount_usd).toFixed(2)} USD could not be processed. Reason: ${reason || 'Not specified'}. Your reserved funds have been released.${imttNote}`,
        type:        'SYSTEM',
        category:    'WALLET',
        referenceId: String(req.params.id),
      }).catch(() => {});

      res.json({
        success:       true,
        imtt_refunded: imttAmount,
        message:       `Withdrawal rejected. Reserved funds released back to ${wr.full_name}'s available balance.${imttAmount > 0 ? ` IMTT of $${imttAmount.toFixed(2)} refunded.` : ''}`,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not reject withdrawal: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ════════════════════════════════════════════════════════
// ADMIN — TREASURY RECONCILIATION
// ════════════════════════════════════════════════════════

// GET /api/wallet/admin/treasury — platform-wide balance summary
router.get('/admin/treasury',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [[totals]] = await db.execute(`
        SELECT
          SUM(balance_usd)   AS total_investor_usd,
          SUM(balance_usdc)  AS total_investor_usdc,
          SUM(reserved_usd)  AS total_reserved_usd,
          COUNT(*)           AS total_wallets
        FROM investor_wallets
      `);

      const [[treasury]] = await db.execute(
        'SELECT * FROM platform_treasury WHERE id = 1'
      );

      const [[pendingDep]] = await db.execute(
        "SELECT COUNT(*) AS count, COALESCE(SUM(amount_usd),0) AS total FROM deposit_requests WHERE status = 'PENDING'"
      );
      const [[pendingWith]] = await db.execute(
        "SELECT COUNT(*) AS count, COALESCE(SUM(amount_usd),0) AS total FROM withdrawal_requests WHERE status IN ('PENDING','PROCESSING')"
      );
      const [[feesCollected]] = await db.execute(
        "SELECT COALESCE(SUM(amount_usd),0) AS total FROM wallet_transactions WHERE type = 'FEE'"
      );

      res.json({
        investor_balances: {
          total_usd:      parseFloat(totals.total_investor_usd  || 0),
          total_usdc:     parseFloat(totals.total_investor_usdc || 0),
          total_reserved: parseFloat(totals.total_reserved_usd  || 0),
          total_wallets:  parseInt(totals.total_wallets || 0),
        },
        platform_treasury: {
          usd_liability:  parseFloat(treasury?.usd_liability || 0),
          usdc_balance:   parseFloat(treasury?.usdc_balance  || 0),
        },
        pending: {
          deposits:        { count: pendingDep.count,  total: parseFloat(pendingDep.total)  },
          withdrawals:     { count: pendingWith.count, total: parseFloat(pendingWith.total) },
        },
        fees_collected_usd: Math.abs(parseFloat(feesCollected.total || 0)),
      });
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch treasury data: ' + err.message });
    }
  }
);

// GET /api/wallet/admin/transactions — full transaction ledger for admin
router.get('/admin/transactions',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const limit  = Math.min(100, parseInt(req.query.limit)  || 25);
      const offset = Math.max(0,   parseInt(req.query.offset) || 0);
      const type   = req.query.type;

      const whereClause = type ? 'WHERE wt.type = ?' : '';
      const params = type
        ? [type, limit, offset]
        : [limit, offset];

      const [rows] = await db.execute(`
        SELECT
          wt.*,
          u.full_name,
          u.email
        FROM wallet_transactions wt
        LEFT JOIN users u ON u.id = wt.user_id
        ${whereClause}
        ORDER BY wt.created_at DESC
        LIMIT ? OFFSET ?
      `, params);

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch transactions: ' + err.message });
    }
  }
);

// ════════════════════════════════════════════════════════
// USDC SUPERVISED PILOT — SI 99 of 2026
// Kill switch: usdc_pilot_enabled platform setting must be TRUE.
// Residency-based IMTT: applies only to Zimbabwe-resident investors
// (country_of_residence = 'ZW' or nationality = 'ZW').
// ════════════════════════════════════════════════════════

const { requireUsdcEnabled } = require('../../middleware/usdcPilot');

// Helper: determine if investor is Zimbabwe-resident (IMTT applies)
async function isZimbabweResident(userId) {
  const [rows] = await db.execute(
    `SELECT country_of_residence, nationality FROM kyc_records
     WHERE user_id = ? AND status = 'APPROVED'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return false;
  const r = rows[0];
  return (r.country_of_residence || '').toUpperCase() === 'ZW' ||
         (r.nationality || '').toUpperCase() === 'ZW';
}

// POST /api/wallet/usdc/deposit — investor submits USDC deposit intent
// The investor sends USDC on-chain to the omnibus wallet; this records the intent.
router.post('/usdc/deposit', authenticate, requireUsdcEnabled, async (req, res) => {
  try {
    const { amount_usdc, tx_hash, notes } = req.body;
    if (!amount_usdc || !tx_hash)
      return res.status(400).json({ error: 'amount_usdc and tx_hash are required' });

    const amt = parseFloat(amount_usdc);
    if (isNaN(amt) || amt <= 0)
      return res.status(400).json({ error: 'amount_usdc must be a positive number' });

    const [minRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_deposit_min_usd'"
    );
    const minUsd = parseFloat(minRows[0]?.value || 50);
    if (amt < minUsd)
      return res.status(400).json({ error: `Minimum USDC deposit is ${minUsd} USDC` });

    // Validate tx_hash format (Polygon tx hash)
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx_hash))
      return res.status(400).json({ error: 'Invalid transaction hash format' });

    // Check for duplicate tx_hash submission
    const [dupRows] = await db.execute(
      "SELECT id FROM deposit_requests WHERE reference = ? AND status != 'REJECTED'",
      [tx_hash]
    );
    if (dupRows.length > 0)
      return res.status(409).json({ error: 'This transaction hash has already been submitted' });

    const [omniRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_omnibus_wallet'"
    );
    const omnibusWallet = omniRows[0]?.value || '';

    const depositId = uuidv4();
    await db.execute(
      `INSERT INTO deposit_requests (id, user_id, amount_usd, reference, notes, status, currency, tx_hash)
       VALUES (?, ?, ?, ?, ?, 'PENDING', 'USDC', ?)`,
      [depositId, req.user.userId, amt, tx_hash, notes || null, tx_hash]
    );

    const [users] = await db.execute('SELECT full_name, email, wallet_address FROM users WHERE id = ?', [req.user.userId]);
    const investor = users[0] || {};

    mailer.notifyUsdcDepositInitiated({
      investorEmail: investor.email,
      investorName:  investor.full_name || 'Investor',
      amount:        amt,
      txHash:        tx_hash,
      omnibusWallet,
      depositId,
    }).catch(e => console.error('[MAILER] notifyUsdcDepositInitiated failed:', e.message));

    sendMessage({
      recipientId: req.user.userId,
      subject:     `💵 USDC Deposit Received — ${amt.toFixed(2)} USDC`,
      body:        `Your USDC deposit of ${amt.toFixed(2)} USDC has been received.\n\nTransaction: ${tx_hash}\nDeposit ID: ${depositId}\n\nAdmin will verify the on-chain transaction and credit your balance. This typically takes 1–4 business hours.\n\nThis is a supervised pilot under Statutory Instrument 99 of 2026.`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: depositId,
    }).catch(() => {});

    res.json({
      success:   true,
      depositId,
      status:    'PENDING',
      currency:  'USDC',
      amount:    amt,
      tx_hash,
      message:   'USDC deposit submitted. Admin will verify the on-chain transaction and credit your balance within 4 business hours.',
      regulatory_notice: 'This transaction is processed under the TokenEquityX USDC supervised pilot (SI 99 of 2026). USDC is held in a custodial omnibus wallet pending RBZ reporting requirements.',
    });
  } catch (err) {
    res.status(500).json({ error: 'USDC deposit failed: ' + err.message });
  }
});

// POST /api/wallet/usdc/withdraw — investor requests USDC withdrawal
// Residency-based IMTT: 2% withheld for Zimbabwe-resident investors.
router.post('/usdc/withdraw', authenticate, requireUsdcEnabled, async (req, res) => {
  try {
    const { amount_usdc, destination_wallet, notes } = req.body;
    if (!amount_usdc || !destination_wallet)
      return res.status(400).json({ error: 'amount_usdc and destination_wallet are required' });

    if (!/^0x[0-9a-fA-F]{40}$/.test(destination_wallet))
      return res.status(400).json({ error: 'Invalid destination wallet address' });

    const amt = parseFloat(amount_usdc);
    if (isNaN(amt) || amt <= 0)
      return res.status(400).json({ error: 'amount_usdc must be a positive number' });

    const [minRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_withdrawal_min_usd'"
    );
    const minUsd = parseFloat(minRows[0]?.value || 50);
    if (amt < minUsd)
      return res.status(400).json({ error: `Minimum USDC withdrawal is ${minUsd} USDC` });

    // Check USDC balance
    const [walRows] = await db.execute(
      'SELECT balance_usdc FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    const balanceUsdc = parseFloat(walRows[0]?.balance_usdc || 0);
    if (balanceUsdc < amt)
      return res.status(400).json({ error: `Insufficient USDC balance. Available: ${balanceUsdc.toFixed(2)} USDC` });

    // Determine IMTT applicability (Zimbabwe residents only)
    const [imttRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_imtt_rate'"
    );
    const imttRate   = parseFloat(imttRows[0]?.value || 0.02);
    const isResident = await isZimbabweResident(req.user.userId);
    const imttAmount = isResident ? parseFloat((amt * imttRate).toFixed(6)) : 0;
    const netAmount  = parseFloat((amt - imttAmount).toFixed(6));

    const withdrawalId = uuidv4();

    // Reserve balance while pending
    await db.execute(
      `UPDATE investor_wallets SET balance_usdc = balance_usdc - ?, reserved_usd = reserved_usd + ? WHERE user_id = ?`,
      [amt, amt, req.user.userId]
    );

    await db.execute(
      `INSERT INTO withdrawal_requests (id, user_id, amount_usd, bank_name, account_name, account_number, notes, status, currency, destination_wallet, imtt_amount, net_amount)
       VALUES (?, ?, ?, 'USDC_POLYGON', ?, ?, ?, 'PENDING', 'USDC', ?, ?, ?)`,
      [withdrawalId, req.user.userId, amt, destination_wallet, destination_wallet, notes || null, destination_wallet, imttAmount, netAmount]
    );

    // Record IMTT deduction if applicable
    if (imttAmount > 0) {
      await db.execute(
        `INSERT INTO wallet_transactions (id, user_id, type, amount, description, reference_id, created_at)
         VALUES (gen_random_uuid(), ?, 'IMTT', ?, ?, ?, NOW())`,
        [req.user.userId, imttAmount, `IMTT on USDC withdrawal (2% — SI 99 of 2026, Finance Act)`, withdrawalId]
      );
    }

    const [users] = await db.execute('SELECT full_name, email FROM users WHERE id = ?', [req.user.userId]);
    const investor = users[0] || {};

    mailer.notifyUsdcWithdrawalInitiated({
      investorEmail:   investor.email,
      investorName:    investor.full_name || 'Investor',
      amount:          amt,
      netAmount,
      imttAmount,
      imttRate,
      isResident,
      destinationWallet: destination_wallet,
      withdrawalId,
    }).catch(e => console.error('[MAILER] notifyUsdcWithdrawalInitiated failed:', e.message));

    sendMessage({
      recipientId: req.user.userId,
      subject:     `💸 USDC Withdrawal Requested — ${amt.toFixed(2)} USDC`,
      body:        `Your USDC withdrawal request has been received.\n\nRequested: ${amt.toFixed(2)} USDC\n${imttAmount > 0 ? `IMTT (${(imttRate * 100).toFixed(0)}%): ${imttAmount.toFixed(6)} USDC\n` : ''}Net to wallet: ${netAmount.toFixed(6)} USDC\nDestination: ${destination_wallet}\nWithdrawal ID: ${withdrawalId}\n\nAdmin will process the on-chain transfer within 1 business day.`,
      type:        'SYSTEM',
      category:    'WALLET',
      referenceId: withdrawalId,
    }).catch(() => {});

    res.json({
      success:        true,
      withdrawalId,
      status:         'PENDING',
      currency:       'USDC',
      amount_usdc:    amt,
      imtt_amount:    imttAmount,
      imtt_applies:   isResident,
      net_usdc:       netAmount,
      destination:    destination_wallet,
      message:        'USDC withdrawal request submitted. Admin will process the on-chain transfer within 1 business day.',
      regulatory_notice: isResident
        ? `IMTT of ${(imttRate * 100).toFixed(0)}% (${imttAmount.toFixed(6)} USDC) has been withheld in accordance with the Finance Act and SI 99 of 2026.`
        : 'IMTT does not apply to international investors.',
    });
  } catch (err) {
    res.status(500).json({ error: 'USDC withdrawal failed: ' + err.message });
  }
});

// GET /api/wallet/usdc/balance — investor's USDC balance
router.get('/usdc/balance', authenticate, requireUsdcEnabled, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT balance_usdc FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    const balance = parseFloat(rows[0]?.balance_usdc || 0);
    res.json({ balance_usdc: balance, currency: 'USDC', network: 'Polygon PoS' });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch USDC balance: ' + err.message });
  }
});

module.exports = router;
