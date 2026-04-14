// api/src/routes/setup.js
// One-time database setup endpoint
// Hit GET /api/setup/init?secret=tokenequityx-setup-2024 to create all tables
// This endpoint disables itself after successful setup (SETUP_COMPLETE=true)

const router = require('express').Router();
const pool   = require('../db/pool');

const SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                  UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address      VARCHAR(42)  UNIQUE,
  email               VARCHAR(255) UNIQUE,
  full_name           VARCHAR(255),
  password_hash       VARCHAR(255),
  role                VARCHAR(30)  NOT NULL DEFAULT 'INVESTOR',
  kyc_status          VARCHAR(20)  NOT NULL DEFAULT 'NONE',
  account_status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  onboarding_complete BOOLEAN      NOT NULL DEFAULT FALSE,
  wallet              VARCHAR(42),
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  last_login          TIMESTAMP,
  last_login_ip       VARCHAR(45),
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  id         UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     VARCHAR(42)  NOT NULL,
  nonce      VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_records (
  id                  UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID,
  wallet_address      VARCHAR(42)  NOT NULL DEFAULT '',
  status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  full_name           VARCHAR(255),
  date_of_birth       DATE,
  nationality         VARCHAR(100),
  id_type             VARCHAR(50),
  id_number           VARCHAR(100),
  address_line1       VARCHAR(255),
  address_line2       VARCHAR(255),
  city                VARCHAR(100),
  country             VARCHAR(100),
  investor_tier       VARCHAR(30)  NOT NULL DEFAULT 'RETAIL',
  accredited_investor BOOLEAN      NOT NULL DEFAULT FALSE,
  kyc_reference       VARCHAR(100),
  reviewer_id         VARCHAR(42),
  reviewer_notes      TEXT,
  reviewed_at         TIMESTAMP,
  expires_at          TIMESTAMP,
  submitted_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id         UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id     UUID         NOT NULL,
  doc_type   VARCHAR(50)  NOT NULL,
  file_path  VARCHAR(500) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spvs (
  id              SERIAL       NOT NULL PRIMARY KEY,
  owner_user_id   UUID,
  legal_name      VARCHAR(255) NOT NULL,
  registration_no VARCHAR(100),
  jurisdiction    VARCHAR(100) NOT NULL DEFAULT 'Zimbabwe',
  spv_type        VARCHAR(50)  NOT NULL DEFAULT 'PRIVATE_LIMITED',
  address         TEXT,
  directors       JSONB,
  status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  id                  SERIAL        NOT NULL PRIMARY KEY,
  spv_id              INTEGER,
  symbol              VARCHAR(20)   NOT NULL UNIQUE,
  name                VARCHAR(200)  NOT NULL,
  company_name        VARCHAR(255)  NOT NULL,
  asset_class         VARCHAR(50)   NOT NULL,
  contract_address    VARCHAR(42),
  total_supply        BIGINT        NOT NULL DEFAULT 0,
  price_usd           NUMERIC(18,8) NOT NULL DEFAULT 1.00000000,
  oracle_price        NUMERIC(20,8) NOT NULL DEFAULT 1.00000000,
  current_price_usd   NUMERIC(20,8) NOT NULL DEFAULT 1.00000000,
  market_cap          NUMERIC(20,2),
  change_24h          NUMERIC(8,4)  DEFAULT 0.0000,
  volume_24h          NUMERIC(20,2) DEFAULT 0.00,
  market_state        VARCHAR(20)   NOT NULL DEFAULT 'PRE_LAUNCH',
  trading_mode        VARCHAR(20)   NOT NULL DEFAULT 'PRE_LISTING',
  listing_type        VARCHAR(30),
  listing_price       NUMERIC(20,8) NOT NULL DEFAULT 1.00000000,
  issuer_address      VARCHAR(42)   NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  issuer_id           UUID,
  issued_shares       BIGINT        NOT NULL DEFAULT 0,
  authorised_shares   BIGINT        NOT NULL DEFAULT 0,
  nominal_value_cents INTEGER       NOT NULL DEFAULT 100,
  status              VARCHAR(20)   DEFAULT 'ACTIVE',
  jurisdiction        VARCHAR(100)  DEFAULT 'Zimbabwe',
  description         TEXT,
  ipfs_doc_hash       VARCHAR(100),
  submission_id       INTEGER,
  token_name          VARCHAR(255),
  token_symbol        VARCHAR(20),
  ticker              VARCHAR(20),
  asset_type          VARCHAR(50),
  listed_at           TIMESTAMP,
  created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_wallets (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL UNIQUE,
  balance_usd     NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  balance_usdc    NUMERIC(20,8) NOT NULL DEFAULT 0.00000000,
  reserved_usd    NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  settlement_rail VARCHAR(10)   NOT NULL DEFAULT 'FIAT',
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL,
  type           VARCHAR(20)   NOT NULL,
  amount_usd     NUMERIC(20,2) NOT NULL,
  balance_before NUMERIC(20,2) NOT NULL,
  balance_after  NUMERIC(20,2) NOT NULL,
  reference_id   UUID,
  description    TEXT,
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wt_user    ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wt_type    ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wt_created ON wallet_transactions(created_at);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id           UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL,
  amount_usd   NUMERIC(20,2) NOT NULL,
  reference    VARCHAR(100)  NOT NULL UNIQUE,
  proof_doc    VARCHAR(255),
  notes        TEXT,
  status       VARCHAR(20)   DEFAULT 'PENDING',
  confirmed_by UUID,
  confirmed_at TIMESTAMP,
  created_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dep_user   ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dep_status ON deposit_requests(status);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id             UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL,
  amount_usd     NUMERIC(20,2) NOT NULL,
  bank_name      VARCHAR(255)  NOT NULL,
  account_name   VARCHAR(255)  NOT NULL,
  account_number VARCHAR(100)  NOT NULL,
  branch_code    VARCHAR(50),
  notes          TEXT,
  status         VARCHAR(20)   DEFAULT 'PENDING',
  processed_by   UUID,
  processed_at   TIMESTAMP,
  tx_reference   VARCHAR(100),
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_with_user   ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_with_status ON withdrawal_requests(status);

CREATE TABLE IF NOT EXISTS platform_treasury (
  id               INTEGER       NOT NULL PRIMARY KEY DEFAULT 1,
  usdc_balance     NUMERIC(20,8) NOT NULL DEFAULT 0.00000000,
  usd_liability    NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  last_reconciled  TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id           UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     INTEGER       NOT NULL,
  user_id      UUID          NOT NULL,
  side         VARCHAR(10)   NOT NULL,
  order_type   VARCHAR(10)   NOT NULL DEFAULT 'LIMIT',
  quantity     NUMERIC(20,8) NOT NULL,
  filled_qty   NUMERIC(20,8) NOT NULL DEFAULT 0,
  limit_price  NUMERIC(20,8),
  status       VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
  created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_token  ON orders(token_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);

CREATE TABLE IF NOT EXISTS trades (
  id            SERIAL        NOT NULL PRIMARY KEY,
  token_symbol  VARCHAR(20),
  buy_order_id  UUID,
  sell_order_id UUID,
  buyer_wallet  VARCHAR(42)   NOT NULL,
  seller_wallet VARCHAR(42)   NOT NULL,
  quantity      NUMERIC(20,8) NOT NULL,
  price         NUMERIC(20,8) NOT NULL,
  total_value   NUMERIC(20,8),
  platform_fee  NUMERIC(20,8) NOT NULL DEFAULT 0.00000000,
  tx_hash       VARCHAR(66),
  settled_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
  token_id      VARCHAR(36),
  total_usdc    NUMERIC(20,8),
  matched_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_token   ON trades(token_id);
CREATE INDEX IF NOT EXISTS idx_trades_matched ON trades(matched_at);

CREATE TABLE IF NOT EXISTS market_controls (
  id                   SERIAL    NOT NULL PRIMARY KEY,
  token_id             INTEGER   NOT NULL UNIQUE,
  halted               BOOLEAN   NOT NULL DEFAULT FALSE,
  halt_reason          VARCHAR(255),
  daily_volume_cap_usd NUMERIC(20,2) DEFAULT 0,
  max_trade_size_usd   NUMERIC(20,2) DEFAULT 0,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_holdings (
  id               UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL,
  token_id         INTEGER       NOT NULL,
  balance          NUMERIC(20,8) NOT NULL DEFAULT 0,
  reserved         NUMERIC(20,8) NOT NULL DEFAULT 0,
  average_cost_usd NUMERIC(20,6) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);
CREATE INDEX IF NOT EXISTS idx_holdings_user  ON token_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_token ON token_holdings(token_id);

CREATE TABLE IF NOT EXISTS primary_offerings (
  id                      SERIAL        NOT NULL PRIMARY KEY,
  token_id                INTEGER       NOT NULL,
  issuer_id               UUID          NOT NULL,
  offering_price_usd      NUMERIC(20,8) NOT NULL,
  target_raise_usd        NUMERIC(20,2) NOT NULL,
  min_subscription_usd    NUMERIC(20,2) NOT NULL DEFAULT 100.00,
  max_subscription_usd    NUMERIC(20,2),
  total_tokens_offered    BIGINT        NOT NULL,
  subscription_deadline   TIMESTAMP     NOT NULL,
  offering_rationale      TEXT,
  tokens_subscribed       BIGINT        NOT NULL DEFAULT 0,
  total_raised_usd        NUMERIC(20,2) NOT NULL DEFAULT 0,
  issuance_fee_rate       NUMERIC(8,4)  NOT NULL DEFAULT 0.0200,
  issuance_fee_usd        NUMERIC(20,2) NOT NULL DEFAULT 0,
  net_proceeds_usd        NUMERIC(20,2) NOT NULL DEFAULT 0,
  status                  VARCHAR(30)   NOT NULL DEFAULT 'PENDING_APPROVAL',
  auditor_id              UUID,
  auditor_notes           TEXT,
  auditor_recommendation  VARCHAR(20),
  price_assessment        TEXT,
  auditor_reviewed_at     TIMESTAMP,
  approved_by             UUID,
  approved_at             TIMESTAMP,
  admin_notes             TEXT,
  closed_at               TIMESTAMP,
  disbursed_at            TIMESTAMP,
  disbursed_by            UUID,
  bank_reference          VARCHAR(200),
  created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offering_subscriptions (
  id               SERIAL        NOT NULL PRIMARY KEY,
  offering_id      INTEGER       NOT NULL,
  investor_id      UUID          NOT NULL,
  amount_usd       NUMERIC(20,2) NOT NULL,
  tokens_allocated BIGINT        NOT NULL DEFAULT 0,
  settlement_rail  VARCHAR(10)   NOT NULL DEFAULT 'FIAT',
  status           VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  subscribed_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMP,
  refunded_at      TIMESTAMP,
  UNIQUE(offering_id, investor_id)
);

CREATE TABLE IF NOT EXISTS dividend_rounds (
  id                SERIAL        NOT NULL PRIMARY KEY,
  token_symbol      VARCHAR(20)   NOT NULL,
  round_type        VARCHAR(50)   NOT NULL DEFAULT 'DIVIDEND',
  description       VARCHAR(500),
  total_amount_usdc NUMERIC(20,8) NOT NULL,
  amount_per_token  NUMERIC(20,8) NOT NULL DEFAULT 0,
  snapshot_block    INTEGER,
  claim_deadline    TIMESTAMP     NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
  created_by        VARCHAR(42)   NOT NULL,
  tx_hash           VARCHAR(66),
  total_distributed NUMERIC(20,6) NOT NULL DEFAULT 0,
  total_withheld    NUMERIC(20,6) NOT NULL DEFAULT 0,
  investors_paid    INTEGER       NOT NULL DEFAULT 0,
  created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dividend_claims (
  id                        SERIAL        NOT NULL PRIMARY KEY,
  round_id                  INTEGER       NOT NULL,
  user_id                   UUID,
  wallet_address            VARCHAR(42)   NOT NULL,
  token_symbol              VARCHAR(20)   NOT NULL,
  amount_usdc               NUMERIC(20,6) NOT NULL DEFAULT 0,
  gross_amount              NUMERIC(20,6) NOT NULL DEFAULT 0,
  withholding_rate          NUMERIC(8,4)  NOT NULL DEFAULT 0,
  withholding_tax           NUMERIC(20,6) NOT NULL DEFAULT 0,
  net_amount                NUMERIC(20,6) NOT NULL DEFAULT 0,
  token_balance_at_snapshot NUMERIC(20,8) NOT NULL DEFAULT 0,
  claimed                   BOOLEAN       NOT NULL DEFAULT FALSE,
  claimed_at                TIMESTAMP,
  tx_hash                   VARCHAR(66),
  created_at                TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_user ON dividend_claims(user_id);

CREATE TABLE IF NOT EXISTS bonds (
  id                  SERIAL        NOT NULL PRIMARY KEY,
  token_id            INTEGER       NOT NULL,
  face_value          NUMERIC(20,8) NOT NULL,
  coupon_rate         NUMERIC(8,4)  NOT NULL,
  maturity_date       DATE          NOT NULL,
  payment_schedule    VARCHAR(20)   NOT NULL DEFAULT 'QUARTERLY',
  escrow_balance_usdc NUMERIC(18,6) NOT NULL DEFAULT 0,
  status              VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
  created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bond_coupons (
  id               SERIAL        NOT NULL PRIMARY KEY,
  bond_id          INTEGER       NOT NULL,
  payment_date     DATE          NOT NULL,
  amount_per_token NUMERIC(20,8) NOT NULL,
  total_amount     NUMERIC(20,8) NOT NULL,
  status           VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED',
  tx_hash          VARCHAR(66),
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id            SERIAL       NOT NULL PRIMARY KEY,
  token_id      INTEGER      NOT NULL,
  proposer      VARCHAR(42)  NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  proposal_type VARCHAR(50)  NOT NULL DEFAULT 'GENERAL',
  start_time    TIMESTAMP    NOT NULL,
  end_time      TIMESTAMP    NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votes (
  id          SERIAL      NOT NULL PRIMARY KEY,
  proposal_id INTEGER     NOT NULL,
  voter       VARCHAR(42) NOT NULL,
  vote        BOOLEAN     NOT NULL,
  weight      BIGINT      NOT NULL DEFAULT 1,
  voted_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_submissions (
  id               SERIAL       NOT NULL PRIMARY KEY,
  token_symbol     VARCHAR(20),
  entity_name      VARCHAR(255),
  period           VARCHAR(100),
  submission_type  VARCHAR(50)  NOT NULL DEFAULT 'FINANCIAL_DATA',
  data_json        TEXT,
  document_count   INTEGER      NOT NULL DEFAULT 0,
  status           VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  reference_number VARCHAR(100),
  issuer_wallet    VARCHAR(42),
  assigned_auditor VARCHAR(100),
  auditor_notes    TEXT,
  audit_report     JSONB,
  admin_notes      TEXT,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oracle_prices (
  id            SERIAL        NOT NULL PRIMARY KEY,
  token_id      INTEGER       NOT NULL,
  submission_id INTEGER,
  price         NUMERIC(20,8) NOT NULL,
  methodology   VARCHAR(100),
  auditor_id    VARCHAR(42),
  certified_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuations (
  id              SERIAL        NOT NULL PRIMARY KEY,
  submission_id   INTEGER,
  token_symbol    VARCHAR(20),
  asset_type      VARCHAR(50),
  model_outputs   JSONB,
  blended_value   NUMERIC(20,2),
  price_per_token NUMERIC(20,8),
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id           SERIAL       NOT NULL PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  slug         VARCHAR(500) NOT NULL UNIQUE,
  category     VARCHAR(100) NOT NULL DEFAULT 'General',
  summary      TEXT         NOT NULL,
  body         TEXT         NOT NULL,
  author       VARCHAR(200) NOT NULL,
  author_role  VARCHAR(200),
  read_time    VARCHAR(20)  DEFAULT '5 min',
  featured     BOOLEAN      NOT NULL DEFAULT FALSE,
  published    BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_clients (
  id          SERIAL       NOT NULL PRIMARY KEY,
  partner_id  UUID         NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id         SERIAL        NOT NULL PRIMARY KEY,
  partner_id UUID          NOT NULL,
  trade_id   INTEGER,
  amount_usd NUMERIC(20,2) NOT NULL,
  status     VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_leads (
  id         SERIAL       NOT NULL PRIMARY KEY,
  partner_id UUID         NOT NULL,
  lead_name  VARCHAR(255) NOT NULL,
  lead_email VARCHAR(255),
  lead_type  VARCHAR(50)  NOT NULL DEFAULT 'INVESTOR',
  status     VARCHAR(20)  NOT NULL DEFAULT 'NEW',
  notes      TEXT,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id    INTEGER,
  from_wallet VARCHAR(42)   NOT NULL,
  to_wallet   VARCHAR(42)   NOT NULL,
  amount      NUMERIC(20,8) NOT NULL,
  tx_type     VARCHAR(30)   NOT NULL,
  tx_hash     VARCHAR(66),
  block_num   INTEGER,
  created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL       NOT NULL PRIMARY KEY,
  action        VARCHAR(100) NOT NULL,
  performed_by  UUID,
  target_entity VARCHAR(200),
  details       TEXT,
  ip_address    VARCHAR(45),
  user_id       UUID,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id             SERIAL        NOT NULL PRIMARY KEY,
  snapshot_date  DATE          NOT NULL UNIQUE,
  total_aum      NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_users    INTEGER       NOT NULL DEFAULT 0,
  total_trades   INTEGER       NOT NULL DEFAULT 0,
  total_volume   NUMERIC(20,2) NOT NULL DEFAULT 0,
  fees_collected NUMERIC(20,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date);

INSERT INTO platform_treasury (id, usdc_balance, usd_liability) VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, full_name, password_hash, role, kyc_status, is_active, onboarding_complete, wallet_address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@tokenequityx.co.zw',    'Platform Admin',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN',    'APPROVED', TRUE, TRUE, '0x0000000000000000000000000000000000000001'),
  ('00000000-0000-0000-0000-000000000002', 'auditor@tokenequityx.co.zw',  'Lead Auditor',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'AUDITOR',  'APPROVED', TRUE, TRUE, '0x0000000000000000000000000000000000000002'),
  ('00000000-0000-0000-0000-000000000003', 'issuer@tokenequityx.co.zw',   'Test Issuer',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ISSUER',   'APPROVED', TRUE, TRUE, '0x0000000000000000000000000000000000000003'),
  ('00000000-0000-0000-0000-000000000004', 'investor@tokenequityx.co.zw', 'Test Investor',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'INVESTOR', 'APPROVED', TRUE, TRUE, '0x0000000000000000000000000000000000000004'),
  ('00000000-0000-0000-0000-000000000005', 'partner@tokenequityx.co.zw',  'Test Partner',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PARTNER',  'APPROVED', TRUE, TRUE, '0x0000000000000000000000000000000000000005')
ON CONFLICT (email) DO NOTHING;

INSERT INTO investor_wallets (user_id, balance_usd, balance_usdc, reserved_usd, settlement_rail) VALUES
  ('00000000-0000-0000-0000-000000000004', 10000.00, 0, 0, 'FIAT'),
  ('00000000-0000-0000-0000-000000000003', 50000.00, 0, 0, 'FIAT')
ON CONFLICT (user_id) DO NOTHING;
`;

router.get('/init', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }

  try {
    // Split schema into individual statements and run each one
    const statements = SCHEMA
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const results = [];
    for (const stmt of statements) {
      try {
        await pool._pool.query(stmt);
        results.push({ ok: true, preview: stmt.substring(0, 60) });
      } catch (err) {
        results.push({ ok: false, preview: stmt.substring(0, 60), error: err.message });
      }
    }

    const failed = results.filter(r => !r.ok);
    res.json({
      success: true,
      total: results.length,
      failed: failed.length,
      message: failed.length === 0
        ? '✅ Database setup complete — all tables created and seeded'
        : `⚠️ Setup complete with ${failed.length} warnings`,
      failures: failed,
    });
  } catch (err) {
    res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
});

module.exports = router;
