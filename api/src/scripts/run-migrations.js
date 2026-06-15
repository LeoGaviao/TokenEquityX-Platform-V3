#!/usr/bin/env node
/**
 * run-migrations.js
 * Executes pending-migrations.sql against the configured DATABASE_URL.
 * Safe to run multiple times — every statement is idempotent.
 *
 * Usage:
 *   node api/src/scripts/run-migrations.js
 *   node api/src/scripts/run-migrations.js --dry-run   (print SQL, no exec)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SQL_FILE = path.join(__dirname, 'pending-migrations.sql');
const DRY_RUN  = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL not set. Ensure api/.env is loaded.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  // Split on ; — skip blank lines and pure-comment blocks
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.replace(/--[^\n]*/g, '').trim() === '');

  if (DRY_RUN) {
    console.log('=== DRY RUN — statements that WOULD execute ===\n');
    statements.forEach((s, i) => console.log(`[${i + 1}] ${s};\n`));
    console.log('=== END DRY RUN ===');
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    console.log(`Running ${statements.length} migration statement(s)…`);
    let ok = 0;
    let skipped = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Skip SELECT statements (verification queries at end of SQL file)
      if (/^\s*SELECT\b/i.test(stmt)) {
        const result = await client.query(stmt);
        console.log(`[${i + 1}] SELECT — ${result.rows.length} row(s):`);
        console.table(result.rows);
        skipped++;
        continue;
      }
      try {
        await client.query(stmt);
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
        console.log(`[${i + 1}] ✅  ${preview}…`);
        ok++;
      } catch (err) {
        console.error(`[${i + 1}] ❌  ${err.message}`);
        console.error(`     Statement: ${stmt.slice(0, 120)}`);
        // Do NOT abort — remaining statements may still succeed
      }
    }

    console.log(`\nDone. ${ok} applied, ${skipped} info/select.`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration runner crashed:', err.message);
  process.exit(1);
});
