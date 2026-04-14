const bcrypt = require('bcryptjs');
const db = require('./src/db/pool');

async function fix() {
  const hash = await bcrypt.hash('2102Equity77#', 12);
  await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, 'staff-admin-001']);
  console.log('Done');
  process.exit(0);
}
fix().catch(e => { console.error(e); process.exit(1); });