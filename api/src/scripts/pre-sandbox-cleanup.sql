-- =============================================================================
-- TokenEquityX V3 — Pre-Sandbox Cleanup Script
-- Run ONCE before the SECZ sandbox session.
-- Creates a clean demo state: one ADMIN, one COMPLIANCE officer, 3 test investors.
-- WARNING: This script REMOVES all non-production user data and test tokens.
-- =============================================================================

-- ── 0. Safety lock — only run in non-prod or with explicit override ───────────
-- Uncomment the line below to abort if accidentally run on live production:
-- DO $$ BEGIN RAISE EXCEPTION 'Aborting: set ALLOW_CLEANUP=1 in psql session to proceed'; END $$;

-- ── 1. Delete test/demo data — preserve audit trail records ──────────────────

-- Remove test trades (no real settlement, no active investor funds)
DELETE FROM trades
WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%'
);

-- Remove test deposit and withdrawal requests
DELETE FROM deposit_requests
WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%'
);

DELETE FROM withdrawal_requests
WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%'
);

-- Reset investor wallets for test accounts (zero balances cleanly)
UPDATE investor_wallets SET
  balance_usd  = 0,
  balance_usdc = 0,
  balance_zar  = 0
WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%'
);

-- Remove test KYC records
DELETE FROM kyc_records
WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%'
);

-- Remove test users
DELETE FROM users
WHERE email LIKE '%@test.%' OR email LIKE '%@demo.%';

-- ── 2. Remove Hardhat seed accounts (wallet-only test accounts) ───────────────
-- These are identified by the fake wallet placeholder pattern email_XXXXXXXX
DELETE FROM users
WHERE wallet LIKE 'email_%' AND wallet_address IS NULL
  AND email IS NULL;

-- ── 3. Ensure super-admin account exists ──────────────────────────────────────
-- Platform admin must exist before sandbox; password set manually via /api/auth/signup
-- or /api/admin/staff endpoint. Verify manually:
-- SELECT id, email, role, kyc_status, is_active FROM users WHERE role = 'ADMIN';

-- ── 4. Reset platform_settings to sandbox-safe defaults ──────────────────────
UPDATE platform_settings SET value = 'false' WHERE key = 'usdc_pilot_enabled';
UPDATE platform_settings SET value = ''      WHERE key = 'usdc_omnibus_wallet';

-- ── 5. Confirm reconciliation_mode is DAILY (not HOURLY) for sandbox ─────────
INSERT INTO platform_settings (key, value, description)
  VALUES ('reconciliation_mode', 'DAILY', 'Reconciliation schedule: DAILY or HOURLY')
ON CONFLICT (key) DO UPDATE SET value = 'DAILY';

-- ── 6. Role promotion helpers ─────────────────────────────────────────────────
-- Use the API endpoint: PUT /api/admin/users/:id/role
-- Or directly in DB:
--   UPDATE users SET role = 'COMPLIANCE' WHERE email = 'compliance@yourdomain.com';
--   UPDATE users SET role = 'ADMIN'      WHERE email = 'admin@yourdomain.com';
-- These are commented out intentionally — substitute real emails before running.

-- ── 7. Verify final state ─────────────────────────────────────────────────────
SELECT role, COUNT(*) AS count, bool_and(is_active) AS all_active
FROM users
GROUP BY role
ORDER BY role;

SELECT key, value
FROM platform_settings
WHERE key IN (
  'usdc_pilot_enabled',
  'usdc_omnibus_wallet',
  'reconciliation_mode',
  'platform_fee_rate',
  'secz_levy_rate',
  'annual_spv_fee_usd'
)
ORDER BY key;

-- =============================================================================
-- END — Review output above before proceeding to sandbox session.
-- =============================================================================
