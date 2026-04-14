// ════════════════════════════════════════════════════════════════
// patch_app_v32.js — TokenEquityX V3.2 route patcher
//
// Run from: C:\xampp\htdocs\TokenEquityX-Platform-V3\api
//   node patch_app_v32.js
//
// What it does:
//   1. Adds /api/auth    route (email/password auth + staff creation)
//   2. Adds /api/bourse  route (bourse listing + live market data)
//   3. Adds /api/partner route (partner pipeline + commissions)
//   Does NOT remove or overwrite any existing routes.
// ════════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');

if (!fs.existsSync(appPath)) {
  console.error('❌ app.js not found at', appPath);
  process.exit(1);
}

let app = fs.readFileSync(appPath, 'utf8');
let modified = false;

// ── Routes to inject ─────────────────────────────────────────────
const newRoutes = [
  { path: '/api/auth',    file: './src/routes/auth',    label: 'auth (email login + staff)' },
  { path: '/api/bourse',  file: './src/routes/bourse',  label: 'bourse (listings + market data)' },
  { path: '/api/partner', file: './src/routes/partner', label: 'partner (pipeline + commissions)' },
];

for (const route of newRoutes) {
  const line = `app.use('${route.path}',`;

  if (app.includes(line)) {
    console.log(`⏭  ${route.path} already registered — skipping`);
    continue;
  }

  // Find a good insertion point — after the last app.use('/api/...) line
  // Strategy: find the last occurrence of "app.use('/api/" and insert after that whole line
  const regex = /app\.use\('\/api\/[^']+',\s*require\([^)]+\)\);?\s*\n/g;
  let lastMatch = null;
  let m;
  while ((m = regex.exec(app)) !== null) {
    lastMatch = m;
  }

  const newLine = `app.use('${route.path}', require('${route.file}'));\n`;

  if (lastMatch) {
    const insertAt = lastMatch.index + lastMatch[0].length;
    app = app.slice(0, insertAt) + newLine + app.slice(insertAt);
    console.log(`✅ Registered: ${route.path} — ${route.label}`);
    modified = true;
  } else {
    // Fallback: insert before the error handler or listen call
    const fallback = app.indexOf('\n// Global error') !== -1
      ? '\n// Global error'
      : app.indexOf('\napp.listen') !== -1
        ? '\napp.listen'
        : null;

    if (fallback) {
      app = app.replace(fallback, '\n' + newLine + fallback);
      console.log(`✅ Registered (fallback): ${route.path} — ${route.label}`);
      modified = true;
    } else {
      console.log(`⚠️  Could not find insertion point for ${route.path}. Add manually:\n   ${newLine}`);
    }
  }
}

// ── Also ensure /api/auth isn't conflicting with existing MetaMask auth ──
// The new auth.js is additive — it ADDS email/password routes but
// the MetaMask connect-wallet route is also inside auth.js now.
// If your current app.js registers auth separately, check for conflict:
if (app.includes("require('./src/routes/auth')") || app.includes('require("./src/routes/auth")')) {
  // Count occurrences
  const count = (app.match(/routes\/auth/g) || []).length;
  if (count > 1) {
    console.log('\n⚠️  WARNING: auth route appears to be registered more than once.');
    console.log('   Open app.js and remove the duplicate /api/auth registration.');
    console.log('   Keep only the one pointing to ./src/routes/auth\n');
  }
}

if (modified) {
  // Backup original
  fs.writeFileSync(appPath + '.bak', fs.readFileSync(appPath));
  fs.writeFileSync(appPath, app, 'utf8');
  console.log('\n✅ app.js updated. Original backed up to app.js.bak');
  console.log('   Restart the API: node app.js\n');
} else {
  console.log('\n✅ No changes needed — all routes already registered.');
}

// ── Preview: show all registered routes ──────────────────────────
console.log('\n── Current route registrations in app.js: ──');
const routeLines = app.match(/app\.use\('\/api\/[^']+'.+/g) || [];
routeLines.forEach(l => console.log('  ', l.trim()));
console.log('');
