-- =============================================================================
-- TokenEquityX V3 — Pending Migrations (idempotent)
-- Apply to production before SECZ sandbox session
-- All statements use IF NOT EXISTS / ON CONFLICT DO NOTHING — safe to re-run.
-- =============================================================================

-- ── 1. data_submissions — escalation columns ──────────────────────────────────
ALTER TABLE data_submissions
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

ALTER TABLE data_submissions
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- ── 2. reconciliation_logs — currency column ──────────────────────────────────
ALTER TABLE reconciliation_logs
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USDC';

-- ── 3. deposit_requests — USDC columns ────────────────────────────────────────
ALTER TABLE deposit_requests
  ADD COLUMN IF NOT EXISTS currency           VARCHAR(10)   DEFAULT 'USD';

ALTER TABLE deposit_requests
  ADD COLUMN IF NOT EXISTS tx_hash            VARCHAR(66);

-- ── 4. withdrawal_requests — USDC columns ────────────────────────────────────
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS currency           VARCHAR(10)   DEFAULT 'USD';

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS destination_wallet VARCHAR(42);

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS imtt_amount        NUMERIC(20,8) DEFAULT 0;

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS net_amount         NUMERIC(20,8);

-- ── 5. users — wallet_address column (if not already created by CREATE TABLE) ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE;

-- ── 6. trades — secz_levy column ─────────────────────────────────────────────
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS secz_levy NUMERIC(20,8) DEFAULT 0;

-- ── 7. platform_settings — new rows ──────────────────────────────────────────
INSERT INTO platform_settings (key, value, description) VALUES
  ('annual_spv_fee_usd',         '5000.00', 'Annual SPV maintenance fee charged to token issuers (USD)'),
  ('ipl_rate',                   '0.00025', 'Investor Protection Levy rate (e.g. 0.00025 = 0.025%)'),
  ('partner_commission_rate',    '0.001',   'Referral commission rate for banking/broker partners (e.g. 0.001 = 0.1%)'),
  ('usdc_pilot_enabled',         'false',   'USDC supervised pilot under SI 99 of 2026. Set true only after RBZ written confirmation.'),
  ('usdc_omnibus_wallet',        '',        'Polygon omnibus wallet address holding platform USDC (0x...)'),
  ('usdc_deposit_min_usd',       '50',      'Minimum USDC deposit amount in USD-equivalent'),
  ('usdc_withdrawal_min_usd',    '50',      'Minimum USDC withdrawal amount in USD-equivalent'),
  ('usdc_imtt_rate',             '0.02',    'IMTT rate applied to USDC withdrawals for Zimbabwe-resident investors (2% per Finance Act)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- END
-- =============================================================================
