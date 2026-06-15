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
-- SI 99 OF 2026 COMPLIANCE MIGRATIONS (Tasks 1–5)
-- Money Laundering and Proceeds of Crime (VASP Registration) Regulations, 2026
-- Administered by the Financial Intelligence Unit (FIU), RBZ
-- =============================================================================

-- ── 8. kyc_records — Travel Rule and CDD required fields (Task 1f / Task 5b) ──
ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS country_of_residence VARCHAR(10);

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS nationality          VARCHAR(10);

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS national_id          VARCHAR(50);

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS passport_number      VARCHAR(50);

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS street_address       VARCHAR(255);

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS source_of_funds      TEXT;

ALTER TABLE kyc_records
  ADD COLUMN IF NOT EXISTS investment_purpose   TEXT;

-- Backfill country_of_residence from existing country column where not already set
UPDATE kyc_records
  SET country_of_residence = UPPER(LEFT(country, 2))
WHERE country_of_residence IS NULL
  AND country IS NOT NULL
  AND LENGTH(country) = 2;

-- ── 9. Travel Rule records table (Task 2a) ────────────────────────────────────
-- SI 99 of 2026, Part V, Sections 17-20 — Ordering VASP obligations
CREATE TABLE IF NOT EXISTS travel_rule_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        UUID        NOT NULL,
  transaction_type      VARCHAR(20) NOT NULL,
  originator_user_id    UUID        NOT NULL,
  originator_full_name  VARCHAR(255) NOT NULL,
  originator_wallet     VARCHAR(42),
  originator_id_number  VARCHAR(100),
  originator_dob        DATE,
  originator_country    VARCHAR(100),
  originator_city       VARCHAR(100),
  beneficiary_name      VARCHAR(255),
  beneficiary_wallet    VARCHAR(42),
  beneficiary_country   VARCHAR(100),
  beneficiary_city      VARCHAR(100),
  amount_usd            NUMERIC(20,2) NOT NULL,
  currency              VARCHAR(10)   DEFAULT 'USD',
  vasp_reference        VARCHAR(100),
  status                VARCHAR(20)   DEFAULT 'RECORDED',
  ivms_101_payload      JSONB,
  created_at            TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_rule_transaction
  ON travel_rule_records(transaction_id);

CREATE INDEX IF NOT EXISTS idx_travel_rule_originator
  ON travel_rule_records(originator_user_id);

CREATE INDEX IF NOT EXISTS idx_travel_rule_created
  ON travel_rule_records(created_at);

-- ── 10. CDD checks table (Task 3a) ────────────────────────────────────────────
-- SI 99 of 2026, Section 21 — CDD for transactions >= USD 1,000
CREATE TABLE IF NOT EXISTS cdd_checks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL,
  transaction_id    UUID,
  transaction_type  VARCHAR(30) NOT NULL,
  amount_usd        NUMERIC(20,2) NOT NULL,
  triggered_at      TIMESTAMPTZ   DEFAULT NOW(),
  cdd_status        VARCHAR(20)   DEFAULT 'PENDING',
  source_of_funds   TEXT,
  purpose           TEXT,
  risk_score        INTEGER       DEFAULT 0,
  reviewer_id       UUID,
  reviewed_at       TIMESTAMPTZ,
  notes             TEXT,
  regulatory_basis  VARCHAR(100)  DEFAULT 'SI 99 of 2026, Section 21'
);

CREATE INDEX IF NOT EXISTS idx_cdd_user
  ON cdd_checks(user_id);

CREATE INDEX IF NOT EXISTS idx_cdd_status
  ON cdd_checks(cdd_status);

CREATE INDEX IF NOT EXISTS idx_cdd_triggered
  ON cdd_checks(triggered_at);

-- ── 11. platform_settings — correct regulatory basis (Task 4a/c) ──────────────
-- USDC settlement basis: RBZ Exchange Control authorisation (not SI 99)
-- SI 99 is the VASP registration framework — it does not authorise USDC settlement
INSERT INTO platform_settings (key, value, description)
VALUES (
  'usdc_regulatory_basis',
  'Pending RBZ Exchange Control authorisation — FIU/RBZ formal engagement initiated',
  'Regulatory basis for USDC settlement (Exchange Control, not VASP registration)'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO platform_settings (key, value, description)
VALUES (
  'usdc_pilot_disclosure',
  'USDC settlement is pending formal written authorisation from the Reserve Bank of Zimbabwe Exchange Control directorate. TokenEquityX has initiated engagement with the RBZ Fintech Unit and Exchange Control division. USDC functionality will be activated only upon receipt of written RBZ authorisation. The Financial Intelligence Unit (FIU), a unit of the Reserve Bank of Zimbabwe, regulates TokenEquityX as a Virtual Asset Service Provider under SI 99 of 2026.',
  'Full public disclosure text for USDC pilot status'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- VASP registration status under SI 99 of 2026
INSERT INTO platform_settings (key, value, description)
VALUES (
  'vasp_registration_status',
  'In preparation — FIU registration under SI 99 of 2026',
  'Current VASP registration status with the Financial Intelligence Unit'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value, description)
VALUES (
  'vasp_regulatory_basis',
  'Money Laundering and Proceeds of Crime (Virtual Asset Service Providers Registration) Regulations, 2026 — SI 99 of 2026. Administered by the Financial Intelligence Unit (FIU), a unit of the Reserve Bank of Zimbabwe.',
  'Full regulatory basis for VASP registration'
) ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- RETAIL IPO PARTICIPATION (Tasks 2–7)
-- Phased subscription support and per-tier investment minimums
-- TokenEquityX policy: any KYC-approved investor who meets the offering minimum
-- may participate in a primary IPO regardless of investor tier.
-- =============================================================================

-- ── 12. primary_offerings — retail IPO and phased subscription columns ────────
ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS anchor_phase_end_date   TIMESTAMPTZ;

ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS public_phase_start_date TIMESTAMPTZ;

ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS institutional_min_usd   NUMERIC(20,2) DEFAULT 10000;

ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS retail_min_usd          NUMERIC(20,2) DEFAULT 100;

ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS allow_retail_ipo        BOOLEAN DEFAULT TRUE;

ALTER TABLE primary_offerings
  ADD COLUMN IF NOT EXISTS risk_warning_required   BOOLEAN DEFAULT TRUE;

-- ── 13. offering_subscriptions — add investor_tier for reporting ───────────────
ALTER TABLE offering_subscriptions
  ADD COLUMN IF NOT EXISTS investor_tier VARCHAR(20) DEFAULT 'RETAIL';

-- =============================================================================
-- END
-- =============================================================================
