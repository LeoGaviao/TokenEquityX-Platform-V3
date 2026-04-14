// Run this from:
// C:\xampp\htdocs\TokenEquityX-Platform-V3\api
//
// node patch_app.js
//
// It adds two things to app.js:
//   1. Static file serving for uploaded files
//   2. The /api/submissions route

const fs   = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');

// ── 1. Add static file serving (after express.json line) ───────
const staticPatch = `
// Serve uploaded files — accessible at /uploads/kyc/filename.pdf etc.
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));
`;

const jsonLine = "app.use(express.json({ limit: '10mb' }));";
if (!app.includes('/uploads') && app.includes(jsonLine)) {
  app = app.replace(jsonLine, jsonLine + staticPatch);
  console.log('✅ Static file serving added');
} else if (app.includes('/uploads')) {
  console.log('⏭  Static file serving already present — skipping');
} else {
  console.log('⚠️  Could not find insertion point for static serving — add manually');
}

// ── 2. Add submissions route ────────────────────────────────────
const routeLine = "app.use('/api/pipeline',   require('./src/routes/pipeline'));";
const submissionsLine = "app.use('/api/submissions', require('./src/routes/submissions'));";

if (!app.includes('/api/submissions') && app.includes(routeLine)) {
  app = app.replace(routeLine, routeLine + '\n' + submissionsLine);
  console.log('✅ /api/submissions route registered');
} else if (app.includes('/api/submissions')) {
  console.log('⏭  Submissions route already registered — skipping');
} else {
  console.log('⚠️  Could not find pipeline route line — add submissions route manually');
}

// ── 3. Add multer error handler before 404 handler ─────────────
const notFoundHandler = "app.use((req, res) => {";
const multerHandler = `
// Handle multer/upload errors cleanly
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB per file.' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files. Max 10 per upload.' });
  if (err.message && err.message.startsWith('File type not allowed')) return res.status(400).json({ error: err.message });
  next(err);
});

`;

if (!app.includes('LIMIT_FILE_SIZE') && app.includes(notFoundHandler)) {
  app = app.replace(notFoundHandler, multerHandler + notFoundHandler);
  console.log('✅ Multer error handler added');
} else {
  console.log('⏭  Multer error handler already present — skipping');
}

fs.writeFileSync(appPath, app, 'utf8');
console.log('\n✅ app.js patched. Restart the API to apply changes (node app.js).');
