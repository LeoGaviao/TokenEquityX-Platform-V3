const router  = require('express').Router();
const db      = require('../db/pool');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── SETUP GUARD ─────────────────────────────────────────────────
function checkSetupEnabled(req, res, next) {
  if (process.env.SETUP_COMPLETE === 'true') {
    return res.status(403).json({
      error:   'Setup already completed',
      message: 'The platform has already been configured.'
    });
  }
  next();
}

// GET /api/setup/status
router.get('/status', (req, res) => {
  res.json({
    setupComplete: process.env.SETUP_COMPLETE === 'true',
    platformName:  process.env.PLATFORM_NAME || 'TokenEquityX',
    version:       '3.0.0'
  });
});

// GET /api/setup/check
router.get('/check', checkSetupEnabled, async (req, res) => {
  const checks = [];

  // Check database connection
  try {
    await db.execute('SELECT 1');
    checks.push({ name: 'Database Connection', status: 'pass', message: 'MySQL connected successfully' });
  } catch (err) {
    checks.push({ name: 'Database Connection', status: 'fail', message: err.message });
  }

  // Check database tables
  try {
    const [tables] = await db.execute('SHOW TABLES');
    const tableCount = tables.length;
    checks.push({
      name:    'Database Schema',
      status:  tableCount >= 15 ? 'pass' : 'warn',
      message: `${tableCount} tables found`
    });
  } catch (err) {
    checks.push({ name: 'Database Schema', status: 'fail', message: 'Could not check tables' });
  }

  // Check Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  checks.push({
    name:    'Node.js Version',
    status:  major >= 18 ? 'pass' : 'warn',
    message: `Running ${nodeVersion}`
  });

  // Check JWT secret
  checks.push({
    name:    'JWT Secret',
    status:  process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-this-to-a-long-random-secret'
      ? 'pass' : 'warn',
    message: process.env.JWT_SECRET === 'change-this-to-a-long-random-secret'
      ? 'Using default secret — change before production use'
      : 'JWT secret configured'
  });

  // Check uploads directory
  const uploadsDir = path.join(__dirname, '../../uploads');
  checks.push({
    name:    'Uploads Directory',
    status:  fs.existsSync(uploadsDir) ? 'pass' : 'warn',
    message: fs.existsSync(uploadsDir) ? 'Directory exists' : 'Will be created on first upload'
  });

  const allPassed = checks.every(c => c.status !== 'fail');
  res.json({ checks, allPassed, canProceed: allPassed });
});

// POST /api/setup/database
router.post('/database', checkSetupEnabled, async (req, res) => {
  const { adminWallet } = req.body;

  try {
    // Verify schema exists
    const [tables] = await db.execute('SHOW TABLES');
    if (tables.length < 15) {
      return res.status(400).json({
        error:   'Schema not found',
        message: 'Please run the schema SQL first'
      });
    }

    // Create admin user if wallet provided
    if (adminWallet) {
      const adminId = uuidv4();
      await db.execute(`
        INSERT INTO users (id, wallet_address, role, kyc_status)
        VALUES (?, ?, 'ADMIN', 'APPROVED')
        ON DUPLICATE KEY UPDATE role = 'ADMIN', kyc_status = 'APPROVED'
      `, [adminId, adminWallet.toLowerCase()]);
    }

    res.json({
      success:     true,
      message:     'Database configured successfully',
      tablesFound: tables.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Database setup failed: ' + err.message });
  }
});

// POST /api/setup/platform
router.post('/platform', checkSetupEnabled, async (req, res) => {
  const {
    platformName, platformTagline, platformUrl,
    adminWallet, feeBps, kycExpiryDays
  } = req.body;

  if (!adminWallet) {
    return res.status(400).json({ error: 'Admin wallet address required' });
  }

  try {
    const adminId = uuidv4();

    // Upsert admin user
    await db.execute(`
      INSERT INTO users (id, wallet_address, role, kyc_status)
      VALUES (?, ?, 'ADMIN', 'APPROVED')
      ON DUPLICATE KEY UPDATE role = 'ADMIN', kyc_status = 'APPROVED'
    `, [adminId, adminWallet.toLowerCase()]);

    // Get the actual user ID (in case it already existed)
    const [users] = await db.execute(
      'SELECT id FROM users WHERE wallet_address = ?',
      [adminWallet.toLowerCase()]
    );
    const actualId = users[0].id;

    // Log setup using the actual ID
    await db.execute(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, details)
      VALUES (?, ?, 'PLATFORM_CONFIGURED', 'system', ?)
    `, [
      uuidv4(), actualId,
      JSON.stringify({ platformName, platformUrl, feeBps })
    ]);

    res.json({
      success: true,
      message: 'Platform configured successfully',
      config:  { platformName, platformTagline, platformUrl }
    });
  } catch (err) {
    res.status(500).json({ error: 'Platform setup failed: ' + err.message });
  }
});

// POST /api/setup/seed
router.post('/seed', checkSetupEnabled, async (req, res) => {
  try {
    const [[userCount]] = await db.execute('SELECT COUNT(*) as count FROM users');
    if (Number(userCount.count) > 1) {
      return res.json({
        success: true,
        skipped: true,
        message: 'Demo data already exists — skipping seed'
      });
    }

    res.json({
      success: true,
      message: 'To load demo data run: node api/src/db/seed.js',
      note:    'Demo data includes 4 sample assets, 8 test users, orders and proposals'
    });
  } catch (err) {
    res.status(500).json({ error: 'Seed check failed: ' + err.message });
  }
});

// POST /api/setup/complete
router.post('/complete', checkSetupEnabled, async (req, res) => {
  const { setupSecret } = req.body;

  if (setupSecret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: 'Invalid setup secret' });
  }

  try {
    // Write SETUP_COMPLETE=true to .env
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('SETUP_COMPLETE=false')) {
        envContent = envContent.replace('SETUP_COMPLETE=false', 'SETUP_COMPLETE=true');
      } else {
        envContent += '\nSETUP_COMPLETE=true';
      }
      fs.writeFileSync(envPath, envContent);
    }

    res.json({
      success:  true,
      message:  'Setup complete! Please restart the platform.',
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not complete setup: ' + err.message });
  }
});

module.exports = router;