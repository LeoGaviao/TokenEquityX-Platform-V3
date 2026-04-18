require('dotenv').config();
const express   = require('express');
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
app.use('/api/setup',      require('./src/routes/setup'));

app.use('/api/bourse', require('./src/routes/bourse'));
app.use('/api/partner', require('./src/routes/partner'));
const walletRoutes = require('./src/routes/wallet');
app.use('/api/wallet', walletRoutes);
app.use('/api/wallet', require('./src/routes/settlementRail'));
app.use('/api/offerings', require('./src/routes/offerings'));
app.use('/api/blog', require('./src/routes/blog'));
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
server.listen(PORT, () => {
  console.log(`✅ TokenEquityX V3 API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws`);
  initWebSocket(server);
  console.log(`✅ WebSocket server initialised`);
});

module.exports = { app, server };


