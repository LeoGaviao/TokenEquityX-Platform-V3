/*
 * TokenEquityX Full Data Reset
 * Clears ALL transactional data — keeps users,
 * KYC, settings, blog posts and audit logs
 *
 * ⚠️  THIS IS IRREVERSIBLE
 * Take a full database backup before running
 *
 * Run via: POST /api/admin/run-migrations
 * with body: { "confirm": "RUN_MIGRATIONS" }
 * (temporarily point the endpoint at this file,
 *  or run directly via Render PostgreSQL console)
 */

-- =============================================================================
-- SECTION 1 — Specific test listings cleanup
-- Removes TEXZ, MGMC, ZWGB, SNDX and all their child records before
-- the full wipe. Safe to run standalone if you only need to remove these.
-- =============================================================================

-- token_holdings references tokens.id (INTEGER)
DELETE FROM token_holdings
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- orders.token_id is INTEGER
DELETE FROM orders
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- trades.token_id is VARCHAR(36) — use token_symbol column instead
DELETE FROM trades
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- p2p_offers has token_symbol VARCHAR(20)
DELETE FROM p2p_offers
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- primary_offerings.token_id is INTEGER
DELETE FROM primary_offerings
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- data_submissions has both token_id (INTEGER) and token_symbol (VARCHAR)
DELETE FROM data_submissions
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

DELETE FROM data_submissions
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- application_fees references submission_id but also has token_symbol
DELETE FROM application_fees
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- market_controls.token_id is INTEGER
DELETE FROM market_controls
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- spv_annual_fees references token_symbol
DELETE FROM spv_annual_fees
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- oracle_prices.token_id is INTEGER
DELETE FROM oracle_prices
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- valuations references token_symbol
DELETE FROM valuations
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- proposals.token_id is INTEGER
DELETE FROM votes
WHERE proposal_id IN (
  SELECT id FROM proposals
  WHERE token_id IN (SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX'))
);

DELETE FROM proposals
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- bonds.token_id is INTEGER
DELETE FROM bond_coupons
WHERE bond_id IN (
  SELECT id FROM bonds
  WHERE token_id IN (SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX'))
);

DELETE FROM bonds
WHERE token_id IN (
  SELECT id FROM tokens WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX')
);

-- risk_acknowledgements references token_symbol
DELETE FROM risk_acknowledgements
WHERE token_symbol IN ('TEXZ','MGMC','ZWGB','SNDX');

-- Now delete the tokens themselves
DELETE FROM tokens
WHERE symbol IN ('TEXZ','MGMC','ZWGB','SNDX');


-- =============================================================================
-- SECTION 2 — Full transactional data wipe
-- FK-safe order: children deleted before parents.
-- Tables preserved: users, kyc_records, kyc_documents, entity_kyc,
--                   platform_settings, blog_posts, partners, audit_logs
-- =============================================================================

-- ── 2.1 Governance (votes → proposals → tokens) ──────────────────────────────
DELETE FROM votes;

DELETE FROM proposals;

-- ── 2.2 Bond coupons → bonds ─────────────────────────────────────────────────
DELETE FROM bond_coupons;

DELETE FROM bonds;

-- ── 2.3 Offering subscriptions (child of primary_offerings) ──────────────────
DELETE FROM offering_subscriptions;

-- ── 2.4 Dividend claims → dividend rounds ────────────────────────────────────
DELETE FROM dividend_claims;

DELETE FROM dividend_rounds;

-- ── 2.5 Risk acknowledgements (has FK REFERENCES users(id) — clear before tokens) ──
DELETE FROM risk_acknowledgements;

-- ── 2.6 Partner activity records (commissions reference trade_id; leads/clients reference user_id) ──
DELETE FROM partner_commissions;

DELETE FROM partner_clients;

DELETE FROM partner_leads;

-- ── 2.7 Oracle prices and valuations (reference token_id / data_submissions) ──
DELETE FROM oracle_prices;

DELETE FROM valuations;

-- ── 2.8 Application fees (reference submission_id from data_submissions) ──────
DELETE FROM application_fees;

-- ── 2.9 Token holdings, orders, trades, p2p offers ───────────────────────────
DELETE FROM token_holdings;

DELETE FROM trades;

DELETE FROM orders;

DELETE FROM p2p_offers;

-- ── 2.10 Market controls (reference token_id) ────────────────────────────────
DELETE FROM market_controls;

-- ── 2.11 SPV annual fees ─────────────────────────────────────────────────────
DELETE FROM spv_annual_fees;

-- ── 2.12 Primary offerings (parent of offering_subscriptions — already cleared) ──
DELETE FROM primary_offerings;

-- ── 2.13 Disbursement queue ──────────────────────────────────────────────────
DELETE FROM disbursement_queue;

-- ── 2.14 Settlement instructions ─────────────────────────────────────────────
DELETE FROM settlement_instructions;

-- ── 2.15 WHT batches ─────────────────────────────────────────────────────────
DELETE FROM wht_batches;

-- ── 2.16 Data submissions and related ────────────────────────────────────────
DELETE FROM data_submissions;

-- ── 2.17 Tokens then SPVs ────────────────────────────────────────────────────
DELETE FROM tokens;

DELETE FROM spvs;

-- ── 2.18 Wallet transactions, deposit and withdrawal requests ─────────────────
DELETE FROM wallet_transactions;

DELETE FROM deposit_requests;

DELETE FROM withdrawal_requests;

-- ── 2.19 Messages and OTPs ───────────────────────────────────────────────────
DELETE FROM messages;

DELETE FROM otps;

-- ── 2.20 Auth nonces (session-based, always transient) ───────────────────────
DELETE FROM auth_nonces;

-- ── 2.21 Blockchain transaction log ──────────────────────────────────────────
DELETE FROM transactions;

-- ── 2.22 Analytics snapshots ─────────────────────────────────────────────────
DELETE FROM analytics_snapshots;

-- ── 2.23 Reconciliation logs ─────────────────────────────────────────────────
DELETE FROM reconciliation_logs;


-- =============================================================================
-- SECTION 3 — Zero out balances (rows preserved, amounts reset)
-- =============================================================================

-- investor_wallets: zero all balance columns that exist in schema
-- Note: reserved_usdc column does not exist in schema — not included
UPDATE investor_wallets SET
  balance_usd  = 0,
  balance_usdc = 0,
  reserved_usd = 0,
  updated_at   = NOW();

-- platform_treasury: single-row table (id = 1)
UPDATE platform_treasury SET
  usdc_balance    = 0,
  usd_liability   = 0,
  last_reconciled = NULL,
  updated_at      = NOW()
WHERE id = 1;


-- =============================================================================
-- SECTION 4 — Verification queries
-- Run these after the reset to confirm state.
-- =============================================================================

SELECT 'users'                AS tbl, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'investor_wallets',      COUNT(*) FROM investor_wallets
UNION ALL
SELECT 'kyc_records',           COUNT(*) FROM kyc_records
UNION ALL
SELECT 'entity_kyc',            COUNT(*) FROM entity_kyc
UNION ALL
SELECT 'platform_settings',     COUNT(*) FROM platform_settings
UNION ALL
SELECT 'audit_logs',            COUNT(*) FROM audit_logs
UNION ALL
SELECT 'blog_posts',            COUNT(*) FROM blog_posts
UNION ALL
SELECT 'tokens',                COUNT(*) FROM tokens
UNION ALL
SELECT 'spvs',                  COUNT(*) FROM spvs
UNION ALL
SELECT 'data_submissions',      COUNT(*) FROM data_submissions
UNION ALL
SELECT 'primary_offerings',     COUNT(*) FROM primary_offerings
UNION ALL
SELECT 'offering_subscriptions',COUNT(*) FROM offering_subscriptions
UNION ALL
SELECT 'token_holdings',        COUNT(*) FROM token_holdings
UNION ALL
SELECT 'orders',                COUNT(*) FROM orders
UNION ALL
SELECT 'trades',                COUNT(*) FROM trades
UNION ALL
SELECT 'p2p_offers',            COUNT(*) FROM p2p_offers
UNION ALL
SELECT 'wallet_transactions',   COUNT(*) FROM wallet_transactions
UNION ALL
SELECT 'deposit_requests',      COUNT(*) FROM deposit_requests
UNION ALL
SELECT 'withdrawal_requests',   COUNT(*) FROM withdrawal_requests
UNION ALL
SELECT 'dividend_rounds',       COUNT(*) FROM dividend_rounds
UNION ALL
SELECT 'dividend_claims',       COUNT(*) FROM dividend_claims
UNION ALL
SELECT 'settlement_instructions',COUNT(*) FROM settlement_instructions
UNION ALL
SELECT 'wht_batches',           COUNT(*) FROM wht_batches
UNION ALL
SELECT 'disbursement_queue',    COUNT(*) FROM disbursement_queue
UNION ALL
SELECT 'reconciliation_logs',   COUNT(*) FROM reconciliation_logs
UNION ALL
SELECT 'messages',              COUNT(*) FROM messages
UNION ALL
SELECT 'otps',                  COUNT(*) FROM otps
UNION ALL
SELECT 'auth_nonces',           COUNT(*) FROM auth_nonces
UNION ALL
SELECT 'transactions',          COUNT(*) FROM transactions
UNION ALL
SELECT 'analytics_snapshots',   COUNT(*) FROM analytics_snapshots
UNION ALL
SELECT 'spv_annual_fees',       COUNT(*) FROM spv_annual_fees
UNION ALL
SELECT 'risk_acknowledgements', COUNT(*) FROM risk_acknowledgements
UNION ALL
SELECT 'market_controls',       COUNT(*) FROM market_controls
UNION ALL
SELECT 'application_fees',      COUNT(*) FROM application_fees
UNION ALL
SELECT 'partner_commissions',   COUNT(*) FROM partner_commissions
UNION ALL
SELECT 'partner_clients',       COUNT(*) FROM partner_clients
UNION ALL
SELECT 'partner_leads',         COUNT(*) FROM partner_leads
UNION ALL
SELECT 'bonds',                 COUNT(*) FROM bonds
UNION ALL
SELECT 'bond_coupons',          COUNT(*) FROM bond_coupons
UNION ALL
SELECT 'proposals',             COUNT(*) FROM proposals
UNION ALL
SELECT 'votes',                 COUNT(*) FROM votes
ORDER BY tbl;

-- Confirm balances are zeroed
SELECT user_id, balance_usd, balance_usdc, reserved_usd
FROM investor_wallets
WHERE balance_usd <> 0 OR balance_usdc <> 0 OR reserved_usd <> 0;

-- Confirm platform treasury is zeroed
SELECT * FROM platform_treasury;

-- =============================================================================
-- END — All expected row counts above should be 0 except:
--   users, kyc_records, entity_kyc, platform_settings, audit_logs, blog_posts
-- investor_wallets rows are preserved but all balances should be 0.
-- =============================================================================
