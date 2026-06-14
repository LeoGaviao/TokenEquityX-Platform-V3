require('dotenv').config();
const express   = require('express');
const cron = require('node-cron');
const http      = require('http');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const logger    = require('./src/utils/logger');
const { initWebSocket, getStats } = require('./src/services/websocket');

const app    = express();
const server = http.createServer(app);

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      process.env.FRONTEND_URL,
      'https://tokenequityx-web.vercel.app',
      'https://tokenequityx.co.zw',
      'https://www.tokenequityx.co.zw',
      'http://localhost:3000',
    ].filter(Boolean);
    if (!origin || allowed.some(a => origin === a || origin.endsWith('.vercel.app'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
// Serve uploaded files — accessible at /uploads/kyc/filename.pdf etc.
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));

app.use(express.urlencoded({ extended: true }));
app.use(logger.requestMiddleware);
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message:  { error: 'Too many requests, please try again later' }
}));

// ─── HEALTH CHECK ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
    platform:  'TokenEquityX V3',
    websocket: getStats()
  });
});

// ─── ROUTES ───────────────────────────────────────────────────────
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/kyc',        require('./src/routes/kyc'));
app.use('/api/assets',     require('./src/routes/assets'));
app.use('/api/governance', require('./src/routes/governance'));
app.use('/api/dividends',  require('./src/routes/dividends'));
app.use('/api/trading',    require('./src/routes/trading'));
app.use('/api/bonds',      require('./src/routes/bonds'));
app.use('/api/ticker',     require('./src/routes/ticker'));
app.use('/api/valuation',  require('./src/routes/valuation'));
app.use('/api/oracle',     require('./src/routes/oracle'));
app.use('/api/auditor',    require('./src/routes/auditor'));
app.use('/api/admin',      require('./src/routes/admin'));
app.use('/api/pipeline',   require('./src/routes/pipeline'));
app.use('/api/submissions', require('./src/routes/submissions'));
// SETUP ROUTES REMOVED — DO NOT RE-ENABLE IN PRODUCTION
// See api/src/routes/setup.js — kept for local dev only
// app.use('/api/setup',      require('./src/routes/setup'));
app.use('/api/investor',   require('./src/routes/investor'));

app.use('/api/bourse', require('./src/routes/bourse'));
app.use('/api/partner', require('./src/routes/partner'));
const walletRoutes = require('./src/routes/wallet');
app.use('/api/wallet', walletRoutes);
app.use('/api/wallet', require('./src/routes/settlementRail'));
app.use('/api/offerings', require('./src/routes/offerings'));
app.use('/api/p2p',      require('./src/routes/p2p'));
app.use('/api/entity-kyc', require('./src/routes/entityKyc'));
app.use('/api/blog', require('./src/routes/blog'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/profile',  require('./src/routes/profile'));
app.use('/api/super-admin',     require('./src/routes/superAdmin'));
app.use('/api/payments',        require('./src/routes/payments'));
app.use('/api/banking-partner', require('./src/routes/bankingPartner'));

if (require.main === module) {
// Daily reconciliation at 18:00
cron.schedule('0 18 * * *', async () => {
  console.log('[CRON] Running daily USDC reconciliation...');
  const { runReconciliation } = require('./src/services/reconciliation');
  try {
    const result = await runReconciliation('SCHEDULED');
    // Push webhook alert if reconciliation has issues
    if (result.status !== 'OK') {
      const { notifyReconciliationAlert } = require('./src/services/webhook');
      notifyReconciliationAlert(result).catch(() => {});
    }
  } catch (err) {
    console.error('[CRON] Reconciliation failed:', err.message);
  }
});

// Daily settlement batch file generation at 16:00
cron.schedule('0 16 * * *', async () => {
  console.log('[CRON] Generating daily settlement batch...');
  try {
    const db = require('./src/db/pool');
    const today = new Date().toISOString().split('T')[0];

    // Get all pending settlement instructions for today
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(net_amount_usd), 0) as total
       FROM settlement_instructions
       WHERE created_at::date = $1 AND status = 'PENDING'`,
      [today]
    );

    const count = parseInt(rows[0]?.count || 0);
    const total = parseFloat(rows[0]?.total || 0);

    console.log(`[CRON] Settlement batch: ${count} pending instructions, total $${total.toFixed(2)}`);

    // Push webhook to banking partner
    if (count > 0) {
      const { pushWebhook } = require('./src/services/webhook');
      pushWebhook('settlement.daily_batch_ready', {
        date: today,
        pending_count: count,
        total_amount_usd: total,
        batch_file_url: `${process.env.PLATFORM_URL || 'https://tokenequityx.co.zw'}/api/banking-partner/batch-file?date=${today}`,
        requires_action: `Process ${count} settlement instruction(s) totalling $${total.toFixed(2)} USD. Download batch file for details.`,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[CRON] Settlement batch failed:', err.message);
  }
});

// Hourly reconciliation option (runs when reconciliation_mode = HOURLY)
cron.schedule('0 * * * *', async () => {
  try {
    const db = require('./src/db/pool');
    const [rows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'reconciliation_mode'"
    );
    if (rows[0]?.value === 'HOURLY') {
      const { runReconciliation } = require('./src/services/reconciliation');
      runReconciliation('HOURLY').catch(() => {});
    }
  } catch {}
});

// Check for annual SPV fee anniversaries — runs daily at 09:00
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Checking SPV annual fee anniversaries...');
  try {
    const db = require('./src/db/pool');
    const { sendMessage } = require('./src/utils/messenger');

    // Get annual fee amount from settings
    const [feeRows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'annual_spv_fee_usd'"
    );
    const feeAmount = parseFloat(feeRows[0]?.value || 5000);

    // Get all ACTIVE tokens with their listing dates
    const [tokens] = await db.execute(
      `SELECT t.token_symbol, t.listed_at, t.issuer_id,
              s.entity_name, s.issuer_wallet
       FROM tokens t
       LEFT JOIN data_submissions s ON s.token_symbol = t.token_symbol
         AND s.submission_type = 'TOKENISATION_APPLICATION'
       WHERE t.status = 'ACTIVE' AND t.listed_at IS NOT NULL
       ORDER BY t.listed_at ASC`
    );

    const today = new Date();

    for (const token of tokens) {
      const listedAt  = new Date(token.listed_at);
      const monthDay  = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const listedMD  = `${String(listedAt.getMonth()+1).padStart(2,'0')}-${String(listedAt.getDate()).padStart(2,'0')}`;

      if (monthDay !== listedMD) continue; // Not anniversary today

      const year      = today.getFullYear();
      const period    = `${year}`;
      const dueDate   = today.toISOString().split('T')[0];

      // Check if fee already created for this period
      const [existing] = await db.execute(
        'SELECT id FROM spv_annual_fees WHERE token_symbol = ? AND fee_period = ?',
        [token.token_symbol, period]
      );
      if (existing.length > 0) continue;

      // Create fee record
      await db.execute(
        `INSERT INTO spv_annual_fees (token_symbol, issuer_id, entity_name, fee_period, amount_usd, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [token.token_symbol, token.issuer_id || token.issuer_wallet, token.entity_name, period, feeAmount, dueDate]
      );

      // Notify issuer
      const recipientId = token.issuer_id || token.issuer_wallet;
      if (recipientId) {
        await sendMessage({
          recipientId,
          subject: `📋 Annual SPV Fee Due — ${token.token_symbol} (${period})`,
          body: `Your annual SPV maintenance fee for ${token.entity_name} (${token.token_symbol}) is now due.\n\nAmount: $${feeAmount.toFixed(2)} USD\nDue Date: ${dueDate}\nPeriod: ${period}\n\nPlease make payment using the bank details in your issuer dashboard. Use reference: TEXZ-SPV-${token.token_symbol}-${period}`,
          type: 'SYSTEM',
          category: 'APPLICATION',
        }).catch(() => {});
      }

      console.log(`[CRON] Annual fee created for ${token.token_symbol} — $${feeAmount}`);
    }
  } catch (err) {
    console.error('[CRON] Annual SPV fee check failed:', err.message);
  }
});
// KYC expiry warning — daily at 09:00, 30 days before expiry
cron.schedule('30 9 * * *', async () => {
  console.log('[CRON] Checking KYC expiry warnings (30-day notice)...');
  try {
    const db = require('./src/db/pool');
    const { sendMessage }            = require('./src/utils/messenger');
    const { notifyInvestorKycExpiring } = require('./src/utils/mailer');

    const [rows] = await db.execute(`
      SELECT u.id, u.email, u.full_name, k.expires_at
      FROM users u
      JOIN kyc_records k ON k.user_id = u.id AND k.status = 'APPROVED'
      WHERE u.kyc_status = 'APPROVED'
        AND k.expires_at IS NOT NULL
        AND k.expires_at::date = CURRENT_DATE + INTERVAL '30 days'
    `);

    console.log(`[CRON] KYC expiry check: ${rows.length} investor(s) expiring in 30 days`);

    for (const investor of rows) {
      await sendMessage({
        recipientId: investor.id,
        subject:     '⚠️ KYC Expiry in 30 Days — Action Required',
        body:        `Your KYC verification expires in 30 days (${new Date(investor.expires_at).toLocaleDateString('en-GB')}). Please log in and renew your KYC to continue trading.`,
        type:        'SYSTEM',
        category:    'KYC',
      }).catch(() => {});

      if (investor.email) {
        notifyInvestorKycExpiring({
          investorEmail: investor.email,
          investorName:  investor.full_name || 'Investor',
          expiryDate:    investor.expires_at,
        }).catch(e => console.error('[MAILER] notifyInvestorKycExpiring failed for', investor.email, e.message));
      }
    }
  } catch (err) {
    console.error('[CRON] KYC expiry check failed:', err.message);
  }
});
// Monthly USDC RBZ report — 1st of each month at 08:00
cron.schedule('0 8 1 * *', async () => {
  console.log('[CRON] Generating monthly USDC RBZ report...');
  try {
    const [pilotRows] = await require('./src/db/pool').execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_pilot_enabled'"
    );
    if (pilotRows[0]?.value !== 'true') {
      console.log('[CRON] USDC pilot disabled — skipping monthly RBZ report');
      return;
    }
    const { generateUsdcMonthlyReport } = require('./src/services/usdcReporting');
    const { notifyUsdcMonthlyReport }   = require('./src/utils/mailer');
    const report = await generateUsdcMonthlyReport();
    console.log(`[CRON] USDC monthly report: ${report.deposits.count} deposits, ${report.withdrawals.count} withdrawals, ${report.active_investors} active investors`);
    notifyUsdcMonthlyReport(report)
      .catch(e => console.error('[CRON] notifyUsdcMonthlyReport failed:', e.message));
  } catch (err) {
    console.error('[CRON] USDC monthly report failed:', err.message);
  }
});

// Weekly platform integrity check — Sunday at 06:00
cron.schedule('0 6 * * 0', async () => {
  console.log('[CRON] Running weekly platform integrity check...');
  try {
    const { runIntegrityChecks }    = require('./src/services/integrityCheck');
    const { sendIntegrityCheckAlert } = require('./src/utils/mailer');
    const report = await runIntegrityChecks();
    console.log(`[CRON] Integrity check: ${report.overallStatus} — ${report.summary.fail} fail, ${report.summary.warn} warn`);
    if (report.overallStatus !== 'OK') {
      sendIntegrityCheckAlert(report)
        .catch(e => console.error('[CRON] sendIntegrityCheckAlert failed:', e.message));
    }
  } catch (err) {
    console.error('[CRON] Integrity check failed:', err.message);
  }
});
} // end require.main === module (cron block)

// ─── 404 HANDLER ──────────────────────────────────────────────────

// Handle multer/upload errors cleanly
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB per file.' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files. Max 10 per upload.' });
  if (err.message && err.message.startsWith('File type not allowed')) return res.status(400).json({ error: err.message });
  next(err);
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error:  err.message,
    stack:  err.stack,
    path:   req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START SERVER ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`✅ TokenEquityX V3 API running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws`);
    initWebSocket(server);
    console.log(`✅ WebSocket server initialised`);
  });
}

module.exports = app;


