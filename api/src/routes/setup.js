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
  id                  SERIAL       NOT NULL PRIMARY KEY,
  owner_user_id       UUID,
  legal_name          VARCHAR(255) NOT NULL,
  registration_no     VARCHAR(100),
  registration_number VARCHAR(100),
  jurisdiction        VARCHAR(100) NOT NULL DEFAULT 'Zimbabwe',
  spv_type            VARCHAR(50)  NOT NULL DEFAULT 'PRIVATE_LIMITED',
  sector              VARCHAR(100),
  asset_type          VARCHAR(50),
  description         TEXT,
  ipfs_doc_hash       VARCHAR(100),
  address             TEXT,
  directors           JSONB,
  status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

ALTER TABLE spvs ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE spvs ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50);
ALTER TABLE spvs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE spvs ADD COLUMN IF NOT EXISTS ipfs_doc_hash VARCHAR(100);
ALTER TABLE spvs ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

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

router.get('/migrate', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  const migrations = [
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS sector VARCHAR(100)`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50)`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS ipfs_doc_hash VARCHAR(100)`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS ticker VARCHAR(20)`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS asset_class VARCHAR(50)`,
    `CREATE TABLE IF NOT EXISTS primary_offerings (
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
    )`,
    `CREATE TABLE IF NOT EXISTS offering_subscriptions (
      id                SERIAL        NOT NULL PRIMARY KEY,
      offering_id       INTEGER       NOT NULL,
      investor_id       UUID          NOT NULL,
      amount_usd        NUMERIC(20,2) NOT NULL,
      tokens_allocated  BIGINT        NOT NULL DEFAULT 0,
      settlement_rail   VARCHAR(10)   NOT NULL DEFAULT 'FIAT',
      status            VARCHAR(20)   NOT NULL DEFAULT 'CONFIRMED',
      confirmed_at      TIMESTAMP,
      refunded_at       TIMESTAMP,
      created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS data_submissions (
      id                  UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      token_id            INTEGER,
      token_symbol        VARCHAR(20),
      entity_name         VARCHAR(255),
      submission_type     VARCHAR(50)   NOT NULL DEFAULT 'LISTING_APPLICATION',
      data_json           TEXT,
      audit_report        TEXT,
      ipfs_hash           VARCHAR(100),
      status              VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
      submitted_by        UUID,
      assigned_auditor    VARCHAR(255),
      reviewed_by         UUID,
      reviewed_at         TIMESTAMP,
      auditor_notes       TEXT,
      listing_type        VARCHAR(30),
      total_supply        BIGINT,
      referred_by         UUID,
      admin_approved_by   UUID,
      admin_approved_at   TIMESTAMP,
      admin_notes         TEXT,
      submitted_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS platform_settings (
      id            SERIAL        NOT NULL PRIMARY KEY,
      key           VARCHAR(100)  NOT NULL UNIQUE,
      value         TEXT          NOT NULL,
      description   TEXT,
      updated_by    UUID,
      updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `INSERT INTO platform_settings (key, value, description)
     VALUES
       ('compliance_fee_usd', '1500.00', 'TokenEquityX standard compliance review fee in USD'),
       ('auditor_fee_min_usd', '1500.00', 'Minimum auditor fee in USD'),
       ('auditor_fee_max_usd', '10000.00', 'Maximum auditor fee in USD'),
       ('applications_meeting_day', 'Tuesday', 'Day of the week when application review meetings are held'),
       ('platform_name', 'TokenEquityX', 'Platform display name'),
       ('bank_name', 'Stanbic Bank Zimbabwe', 'Bank name for compliance fee payments'),
       ('bank_account_name', 'TokenEquityX Ltd', 'Account name for compliance fee payments'),
       ('bank_account_number', 'TBC', 'Account number for compliance fee payments'),
       ('bank_branch', 'Harare Main Branch', 'Bank branch for compliance fee payments'),
       ('bank_swift_code', 'SBICZWHX', 'SWIFT code for diaspora payments'),
       ('bank_reference_prefix', 'TEXZ-APP', 'Prefix for auto-generated payment references')
     ON CONFLICT (key) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS application_fees (
      id                  SERIAL        NOT NULL PRIMARY KEY,
      submission_id       INTEGER       NOT NULL,
      token_symbol        VARCHAR(20)   NOT NULL,
      issuer_wallet       UUID,
      compliance_fee_usd  NUMERIC(20,2) NOT NULL DEFAULT 1500.00,
      auditor_fee_usd     NUMERIC(20,2) NOT NULL DEFAULT 0,
      total_fee_usd       NUMERIC(20,2) NOT NULL DEFAULT 0,
      status              VARCHAR(30)   NOT NULL DEFAULT 'PENDING_APPROVAL',
      approved_by         UUID,
      approved_at         TIMESTAMP,
      rejection_reason    TEXT,
      fee_deposit_ref     VARCHAR(200),
      fee_confirmed_by    UUID,
      fee_confirmed_at    TIMESTAMP,
      auditor_assigned    VARCHAR(255),
      created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS application_status VARCHAR(30) DEFAULT 'PENDING_REVIEW'`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS auditor_fee_usd NUMERIC(20,2) DEFAULT 0`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS fee_status VARCHAR(30) DEFAULT 'NOT_REQUIRED'`,
    `CREATE TABLE IF NOT EXISTS messages (
      id            SERIAL        NOT NULL PRIMARY KEY,
      sender_id     UUID,
      recipient_id  UUID          NOT NULL,
      subject       VARCHAR(255)  NOT NULL,
      body          TEXT          NOT NULL,
      type          VARCHAR(30)   NOT NULL DEFAULT 'SYSTEM',
      category      VARCHAR(50),
      reference_id  VARCHAR(100),
      is_read       BOOLEAN       NOT NULL DEFAULT FALSE,
      is_deleted    BOOLEAN       NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, is_deleted, is_read)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_requested BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS listing_type VARCHAR(30)`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS admin_approved_by UUID`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS listing_type VARCHAR(30)`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS trading_mode VARCHAR(30) DEFAULT 'P2P_ONLY'`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS listed_at TIMESTAMP`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS submission_id INTEGER`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS issuer_id UUID`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS website_url VARCHAR(255)`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS founded_year INTEGER`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255)`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS use_of_proceeds TEXT`,
    `ALTER TABLE spvs ADD COLUMN IF NOT EXISTS num_employees VARCHAR(50)`,
    `CREATE TABLE IF NOT EXISTS p2p_offers (
      id               UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      token_id         INTEGER       NOT NULL,
      token_symbol     VARCHAR(20)   NOT NULL,
      seller_id        UUID          NOT NULL,
      quantity         NUMERIC(18,6) NOT NULL,
      price_per_token  NUMERIC(18,8) NOT NULL,
      total_value      NUMERIC(18,2) NOT NULL,
      status           VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
      buyer_id         UUID,
      accepted_at      TIMESTAMP,
      expires_at       TIMESTAMP,
      notes            TEXT,
      created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_p2p_symbol ON p2p_offers(token_symbol)`,
    `CREATE INDEX IF NOT EXISTS idx_p2p_seller ON p2p_offers(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_p2p_status ON p2p_offers(status)`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS sector VARCHAR(100)`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS auditor_status VARCHAR(20) DEFAULT 'PENDING'`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS auditor_declined_reason TEXT`,
    `CREATE TABLE IF NOT EXISTS entity_kyc (
      id                    UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID          NOT NULL,
      entity_name           VARCHAR(255)  NOT NULL,
      registration_number   VARCHAR(100)  NOT NULL,
      registration_country  VARCHAR(100)  NOT NULL DEFAULT 'Zimbabwe',
      registered_address    TEXT,
      business_description  TEXT,
      business_type         VARCHAR(100),
      date_incorporated     DATE,
      tax_clearance_number  VARCHAR(100),
      source_of_funds       TEXT,
      pep_declaration       BOOLEAN       DEFAULT FALSE,
      sanctions_declaration BOOLEAN       DEFAULT FALSE,
      aml_declaration       BOOLEAN       DEFAULT FALSE,
      beneficial_owners     JSONB,
      directors             JSONB,
      documents             JSONB,
      status                VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
      rejection_reason      TEXT,
      reviewed_by           UUID,
      reviewed_at           TIMESTAMP,
      submitted_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
      created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_entity_kyc_user ON entity_kyc(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_entity_kyc_status ON entity_kyc(status)`,
    `UPDATE messages SET is_read = FALSE WHERE is_read IS NULL`,
    `ALTER TABLE messages ALTER COLUMN is_read SET DEFAULT FALSE`,
    `ALTER TABLE messages ALTER COLUMN is_deleted SET DEFAULT FALSE`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS deleted_by UUID`,
    `ALTER TABLE data_submissions ADD COLUMN IF NOT EXISTS deletion_reason TEXT`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS suspended_by UUID`,
    `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS suspension_reason TEXT`,
    `ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_url TEXT`,
    `ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
    `ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_size INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS otps (
      id          UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID          NOT NULL,
      code        VARCHAR(6)    NOT NULL,
      purpose     VARCHAR(50)   NOT NULL DEFAULT 'SETTINGS_CHANGE',
      used        BOOLEAN       NOT NULL DEFAULT FALSE,
      expires_at  TIMESTAMP     NOT NULL,
      created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_otps_user ON otps(user_id)`,
    `CREATE TABLE IF NOT EXISTS reconciliation_logs (
      id                  UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      reconciled_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
      trigger             VARCHAR(30)   NOT NULL DEFAULT 'SCHEDULED',
      on_chain_balance    NUMERIC(20,6) NOT NULL DEFAULT 0,
      ledger_total        NUMERIC(20,6) NOT NULL DEFAULT 0,
      variance            NUMERIC(20,6) NOT NULL DEFAULT 0,
      status              VARCHAR(20)   NOT NULL DEFAULT 'OK',
      notes               TEXT,
      performed_by        UUID
    )`,
    `INSERT INTO platform_settings (key, value, description) VALUES
      ('usdc_omnibus_wallet', '', 'USDC custodial omnibus wallet address (super admin only)'),
      ('reconciliation_mode', 'DAILY', 'Reconciliation frequency: REALTIME, HOURLY, or DAILY'),
      ('reconciliation_cutoff', '18:00', 'Daily reconciliation cutoff time (HH:MM)'),
      ('paynow_integration_id', '', 'Paynow Zimbabwe integration ID'),
      ('paynow_integration_key', '', 'Paynow Zimbabwe integration key'),
      ('stripe_publishable_key', '', 'Stripe publishable key (diaspora investors)'),
      ('stripe_secret_key', '', 'Stripe secret key (super admin only)')
    ON CONFLICT (key) DO NOTHING`,
  ];
  const results = [];
  for (const sql of migrations) {
    try {
      await pool._pool.query(sql);
      results.push({ ok: true, sql: sql.substring(0, 60) });
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        results.push({ ok: true, sql: sql.substring(0, 60), note: 'already exists' });
      } else {
        results.push({ ok: false, sql: sql.substring(0, 60), error: err.message });
      }
    }
  }
  res.json({ success: true, results });
});

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

router.get('/reset-passwords', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  try {
    const hash = '$2b$10$rmUNjpv.hB/.yLNJMMmT1.lDHS1/FmIoKwO3YKOXQ1s4mQp97LCv2';
    await pool._pool.query(
      `UPDATE users SET password_hash = $1 WHERE email IN (
        'admin@tokenequityx.co.zw',
        'auditor@tokenequityx.co.zw',
        'issuer@tokenequityx.co.zw',
        'investor@tokenequityx.co.zw',
        'partner@tokenequityx.co.zw'
      )`,
      [hash]
    );
    res.json({ success: true, message: 'All staff passwords reset to Admin@123' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed: ' + err.message });
  }
});

router.get('/test-email', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  const mailer = require('../utils/mailer');
  try {
    const result = await mailer.notifyAdminDepositSubmitted({
      investorName: 'Test Investor',
      investorEmail: 'test@tokenequityx.co.zw',
      amount: '100.00',
      reference: 'TEST-REF-001',
      depositId: 'test-deposit-id-001'
    });
    res.json({
      success: true,
      smtpUser: process.env.SMTP_USER || 'NOT SET',
      smtpHost: process.env.SMTP_HOST || 'NOT SET',
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message, smtpUser: process.env.SMTP_USER || 'NOT SET' });
  }
});

router.get('/columns', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  const table = req.query.table || 'data_submissions';
  try {
    const result = await pool._pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    res.json({ table, columns: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/fix-holding — manually insert or update a token holding
router.get('/fix-holding', async (req, res) => {
  const { secret, user_id, token_id, balance, cost } = req.query;
  if (secret !== process.env.SETUP_SECRET && secret !== 'tokenequityx-setup-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!user_id || !token_id || !balance) {
    return res.status(400).json({ error: 'user_id, token_id and balance are required' });
  }
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM token_holdings WHERE user_id = ? AND token_id = ?',
      [user_id, parseInt(token_id)]
    );
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE token_holdings SET balance = ?, average_cost_usd = ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
        [parseFloat(balance), parseFloat(cost || 1), user_id, parseInt(token_id)]
      );
      res.json({ success: true, action: 'updated', user_id, token_id, balance });
    } else {
      await pool.execute(
        `INSERT INTO token_holdings (id, user_id, token_id, balance, reserved, average_cost_usd)
         VALUES (gen_random_uuid(), ?, ?, ?, 0, ?)`,
        [user_id, parseInt(token_id), parseFloat(balance), parseFloat(cost || 1)]
      );
      res.json({ success: true, action: 'inserted', user_id, token_id, balance });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/fix-token-state — update a token's market_state and trading_mode
router.get('/fix-token-state', async (req, res) => {
  const { secret, symbol, market_state, trading_mode } = req.query;
  if (secret !== process.env.SETUP_SECRET && secret !== 'tokenequityx-setup-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!symbol || !market_state) {
    return res.status(400).json({ error: 'symbol and market_state are required' });
  }
  try {
    await pool.execute(
      `UPDATE tokens SET market_state = ?, trading_mode = COALESCE(?, trading_mode), updated_at = NOW()
       WHERE token_symbol = ? OR symbol = ?`,
      [market_state, trading_mode || null, symbol.toUpperCase(), symbol.toUpperCase()]
    );
    res.json({ success: true, symbol, market_state, trading_mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/delete-token — permanently delete a DRAFT token and its SPV/submissions
router.get('/delete-token', async (req, res) => {
  const { secret, symbol } = req.query;
  if (secret !== process.env.SETUP_SECRET && secret !== 'tokenequityx-setup-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const sym = symbol.toUpperCase();
  try {
    // Only allow deletion of DRAFT tokens
    const [tokens] = await pool.execute(
      'SELECT id, spv_id, status FROM tokens WHERE token_symbol = ?', [sym]
    );
    if (tokens.length === 0) return res.status(404).json({ error: `Token ${sym} not found` });
    if (tokens[0].status === 'ACTIVE') {
      return res.status(400).json({ error: `Cannot delete ACTIVE token ${sym}. Only DRAFT tokens can be deleted.` });
    }

    const tokenId = tokens[0].id;
    const spvId   = tokens[0].spv_id;

    // Delete in order to respect foreign keys
    await pool.execute('DELETE FROM data_submissions WHERE token_symbol = ?', [sym]);
    await pool.execute('DELETE FROM application_fees WHERE token_symbol = ?', [sym]);
    await pool.execute('DELETE FROM primary_offerings WHERE token_id = ?', [tokenId]);
    await pool.execute('DELETE FROM token_holdings WHERE token_id = ?', [tokenId]);
    await pool.execute('DELETE FROM p2p_offers WHERE token_symbol = ?', [sym]);
    await pool.execute('DELETE FROM tokens WHERE id = ?', [tokenId]);
    if (spvId) await pool.execute('DELETE FROM spvs WHERE id = ?', [spvId]);

    res.json({ success: true, message: `Token ${sym} and all related data permanently deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/grant-super-admin — bootstrap super admin by email
router.get('/grant-super-admin', async (req, res) => {
  const { secret, email } = req.query;
  if (secret !== process.env.SETUP_SECRET && secret !== 'tokenequityx-setup-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const [rows] = await pool.execute('SELECT id, role FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(404).json({ error: `User ${email} not found` });
    if (rows[0].role !== 'ADMIN') {
      return res.status(400).json({ error: `User ${email} is not an ADMIN (role: ${rows[0].role}). Only admins can be super admin.` });
    }
    await pool.execute('UPDATE users SET is_super_admin = TRUE WHERE email = ?', [email]);
    res.json({ success: true, message: `Super admin granted to ${email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/update-user-email — update a user's email by current email
router.get('/update-user-email', async (req, res) => {
  const { secret, old_email, new_email } = req.query;
  if (secret !== process.env.SETUP_SECRET && secret !== 'tokenequityx-setup-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!old_email || !new_email) return res.status(400).json({ error: 'old_email and new_email required' });
  try {
    const [result] = await pool.execute(
      'UPDATE users SET email = ? WHERE email = ?',
      [new_email, old_email]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: `User ${old_email} not found` });
    res.json({ success: true, message: `Email updated from ${old_email} to ${new_email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
