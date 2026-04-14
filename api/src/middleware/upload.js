// api/src/middleware/upload.js
// Replaces the existing upload middleware with real disk storage

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ── Ensure upload directory exists ─────────────────────────────
const UPLOAD_BASE = path.join(__dirname, '../../uploads');
const dirs = ['kyc', 'assets', 'financials', 'prospectus', 'general'];
dirs.forEach(dir => {
  const full = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// ── Storage engine ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const url = req.originalUrl || '';
    let sub = 'general';
    if (url.includes('/kyc'))                sub = 'kyc';
    if (url.includes('/assets'))             sub = 'assets';
    if (url.includes('/valuation'))          sub = 'financials';
    if (url.includes('/submissions/tokenise')) sub = 'assets';
    if (url.includes('/submissions/financial')) sub = 'financials';
    cb(null, path.join(UPLOAD_BASE, sub));
  },
  filename: (req, file, cb) => {
    // wallet_timestamp_originalname — safe, unique, traceable
    const wallet  = (req.user?.wallet || req.body?.wallet || 'anon')
      .replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const ts      = Date.now();
    const safe    = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${wallet}_${ts}_${safe}`);
  }
});

// ── File filter ─────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Accepted: PDF, Word, Excel, JPG, PNG`), false);
  }
};

// ── Export configured multer ────────────────────────────────────
module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  10 * 1024 * 1024, // 10 MB per file
    files:     10,                // max 10 files per request
  }
});
