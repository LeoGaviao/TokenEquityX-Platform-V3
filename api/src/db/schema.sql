

USE railway;

-- ─── USERS & ROLES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    wallet_address  VARCHAR(42)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    role            VARCHAR(30)  NOT NULL DEFAULT 'INVESTOR',
    kyc_status      VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login      DATETIME,
    last_login_ip   VARCHAR(45),
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce       VARCHAR(64)  PRIMARY KEY,
    wallet      VARCHAR(42)  NOT NULL,
    expires_at  DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

USE railway;

-- ─── KYC ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_records (
    id                  VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    user_id             VARCHAR(36)  NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    date_of_birth       DATE,
    nationality         CHAR(2),
    id_type             VARCHAR(30),
    id_number           VARCHAR(100),
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    country             CHAR(2),
    investor_tier       VARCHAR(20)  NOT NULL DEFAULT 'RETAIL',
    accredited_investor TINYINT(1)   NOT NULL DEFAULT 0,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reviewer_id         VARCHAR(36),
    reviewer_notes      TEXT,
    kyc_reference       VARCHAR(100),
    submitted_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at         DATETIME,
    expires_at          DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kyc_documents (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    kyc_id      VARCHAR(36)  NOT NULL,
    doc_type    VARCHAR(50)  NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    uploaded_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kyc_id) REFERENCES kyc_records(id) ON DELETE CASCADE
);

-- ─── SPVs & COMPANIES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spvs (
    id                  VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    owner_user_id       VARCHAR(36)  NOT NULL,
    legal_name          VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    jurisdiction        CHAR(2)      NOT NULL,
    sector              VARCHAR(100),
    asset_type          VARCHAR(30)  NOT NULL DEFAULT 'EQUITY',
    description         TEXT,
    ipfs_doc_hash       VARCHAR(200),
    kyc_status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- ─── TOKENS / ASSETS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tokens (
    id                  VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    spv_id              VARCHAR(36)   NOT NULL,
    token_name          VARCHAR(100)  NOT NULL,
    token_symbol        VARCHAR(20)   NOT NULL UNIQUE,
    ticker              VARCHAR(20)   NOT NULL UNIQUE,
    contract_address    VARCHAR(42)   UNIQUE,
    network             VARCHAR(30)   NOT NULL DEFAULT 'hardhat',
    asset_type          VARCHAR(30)   NOT NULL DEFAULT 'EQUITY',
    authorised_shares   DECIMAL(36,0) NOT NULL,
    issued_shares       DECIMAL(36,0) NOT NULL DEFAULT 0,
    nominal_value_cents INT           NOT NULL DEFAULT 100,
    current_price_usd   DECIMAL(18,6) DEFAULT 0,
    market_state        VARCHAR(20)   NOT NULL DEFAULT 'PRE_LAUNCH',
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    ipfs_doc_hash       VARCHAR(200),
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (spv_id) REFERENCES spvs(id)
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
    id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id      VARCHAR(36),
    from_user_id  VARCHAR(36),
    to_user_id    VARCHAR(36),
    tx_type       VARCHAR(30)   NOT NULL,
    token_amount  DECIMAL(36,0),
    usd_amount    DECIMAL(18,6),
    tx_hash       VARCHAR(66)   UNIQUE,
    status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id)     REFERENCES tokens(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id)   REFERENCES users(id)
);

-- ─── GOVERNANCE ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
    id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id        VARCHAR(36)   NOT NULL,
    on_chain_id     BIGINT,
    title           VARCHAR(500)  NOT NULL,
    description     TEXT,
    ipfs_doc_hash   VARCHAR(200),
    resolution_type VARCHAR(20)   NOT NULL DEFAULT 'ORDINARY',
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    voting_duration INT           NOT NULL DEFAULT 7,
    start_time      DATETIME,
    end_time        DATETIME,
    votes_for       DECIMAL(36,0) DEFAULT 0,
    votes_against   DECIMAL(36,0) DEFAULT 0,
    votes_abstain   DECIMAL(36,0) DEFAULT 0,
    total_eligible  DECIMAL(36,0) DEFAULT 0,
    created_by      VARCHAR(36),
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id)   REFERENCES tokens(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
    id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    proposal_id VARCHAR(36)   NOT NULL,
    user_id     VARCHAR(36)   NOT NULL,
    choice      VARCHAR(10)   NOT NULL,
    vote_weight DECIMAL(36,0) NOT NULL DEFAULT 1,
    tx_hash     VARCHAR(66),
    voted_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_vote (proposal_id, user_id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id),
    FOREIGN KEY (user_id)     REFERENCES users(id)
);

-- ─── TRADING ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
    id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id      VARCHAR(36)   NOT NULL,
    user_id       VARCHAR(36)   NOT NULL,
    side          CHAR(4)       NOT NULL,
    order_type    VARCHAR(10)   NOT NULL DEFAULT 'LIMIT',
    quantity      DECIMAL(36,0) NOT NULL,
    filled_qty    DECIMAL(36,0) NOT NULL DEFAULT 0,
    limit_price   DECIMAL(18,6),
    status        VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (user_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trades (
    id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    buy_order_id    VARCHAR(36)   NOT NULL,
    sell_order_id   VARCHAR(36)   NOT NULL,
    token_id        VARCHAR(36)   NOT NULL,
    buyer_id        VARCHAR(36)   NOT NULL,
    seller_id       VARCHAR(36)   NOT NULL,
    quantity        DECIMAL(36,0) NOT NULL,
    price           DECIMAL(18,6) NOT NULL,
    total_usdc      DECIMAL(18,6) NOT NULL,
    platform_fee    DECIMAL(18,6) NOT NULL DEFAULT 0,
    tx_hash         VARCHAR(66),
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    matched_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at      DATETIME,
    FOREIGN KEY (buy_order_id)  REFERENCES orders(id),
    FOREIGN KEY (sell_order_id) REFERENCES orders(id),
    FOREIGN KEY (token_id)      REFERENCES tokens(id),
    FOREIGN KEY (buyer_id)      REFERENCES users(id),
    FOREIGN KEY (seller_id)     REFERENCES users(id)
);

-- ─── DIVIDENDS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dividend_rounds (
    id                VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id          VARCHAR(36)   NOT NULL,
    round_type        VARCHAR(20)   NOT NULL DEFAULT 'DIVIDEND',
    description       VARCHAR(255),
    total_amount_usdc DECIMAL(18,6) NOT NULL,
    snapshot_supply   DECIMAL(36,0),
    claim_deadline    DATETIME,
    status            VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    on_chain_round_id BIGINT,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE TABLE IF NOT EXISTS dividend_claims (
    id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    round_id    VARCHAR(36)   NOT NULL,
    user_id     VARCHAR(36)   NOT NULL,
    amount_usdc DECIMAL(18,6) NOT NULL,
    tx_hash     VARCHAR(66),
    status      VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    claimed_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_claim (round_id, user_id),
    FOREIGN KEY (round_id) REFERENCES dividend_rounds(id),
    FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ─── BONDS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bonds (
    id                          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id                    VARCHAR(36)   NOT NULL UNIQUE,
    face_value_per_token        DECIMAL(18,6) NOT NULL,
    coupon_rate_bps             INT           NOT NULL,
    coupon_frequency_days       INT           NOT NULL,
    maturity_date               DATE          NOT NULL,
    next_coupon_date            DATE,
    total_coupons_issued        INT           NOT NULL DEFAULT 0,
    escrow_balance_usdc         DECIMAL(18,6) NOT NULL DEFAULT 0,
    status                      VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    early_redemption_allowed    TINYINT(1)    NOT NULL DEFAULT 0,
    early_redemption_penalty_bps INT          NOT NULL DEFAULT 0,
    created_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE TABLE IF NOT EXISTS bond_coupons (
    id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    bond_id     VARCHAR(36)   NOT NULL,
    round_id    VARCHAR(36),
    amount_usdc DECIMAL(18,6) NOT NULL,
    payment_date DATE         NOT NULL,
    status      VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED',
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bond_id)  REFERENCES bonds(id),
    FOREIGN KEY (round_id) REFERENCES dividend_rounds(id)
);

-- ─── VALUATIONS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS valuations (
    id                VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id          VARCHAR(36)   NOT NULL,
    spv_id            VARCHAR(36)   NOT NULL,
    valuation_usd     DECIMAL(18,2) NOT NULL,
    price_per_token   DECIMAL(18,6) NOT NULL,
    method            VARCHAR(30)   NOT NULL,
    revenue_ttm       DECIMAL(18,2),
    ebitda_ttm        DECIMAL(18,2),
    free_cash_flow    DECIMAL(18,2),
    growth_rate_pct   DECIMAL(6,2),
    discount_rate_pct DECIMAL(6,2),
    total_debt        DECIMAL(18,2),
    cash              DECIMAL(18,2),
    issued_shares     DECIMAL(36,0),
    inputs_json       JSON,
    auditor_approved  TINYINT(1)    NOT NULL DEFAULT 0,
    auditor_id        VARCHAR(36),
    calculated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id)  REFERENCES tokens(id),
    FOREIGN KEY (spv_id)    REFERENCES spvs(id)
);

-- ─── DATA SUBMISSIONS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_submissions (
    id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    token_id        VARCHAR(36)  NOT NULL,
    submitted_by    VARCHAR(36)  NOT NULL,
    data_type       VARCHAR(50)  NOT NULL,
    data_json       JSON,
    ipfs_hash       VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    auditor_id      VARCHAR(36),
    auditor_notes   TEXT,
    reviewed_at     DATETIME,
    submitted_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id)     REFERENCES tokens(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- ─── ORACLE ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oracle_prices (
    id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id        VARCHAR(36)   NOT NULL,
    price_usd       DECIMAL(18,8) NOT NULL,
    data_hash       VARCHAR(66),
    source          VARCHAR(50),
    submission_id   BIGINT,
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    submitted_by    VARCHAR(36),
    approved_by     VARCHAR(36),
    submitted_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at     DATETIME,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- ─── MARKET CONTROLS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_controls (
    id                      VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    token_id                VARCHAR(36)   NOT NULL UNIQUE,
    trading_enabled         TINYINT(1)    NOT NULL DEFAULT 1,
    halted                  TINYINT(1)    NOT NULL DEFAULT 0,
    halt_reason             TEXT,
    daily_volume_cap_usd    DECIMAL(18,2) DEFAULT 0,
    max_trade_size_usd      DECIMAL(18,2) DEFAULT 0,
    max_price_movement_bps  INT           DEFAULT 0,
    updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- ─── AUDIT LOGS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    user_id     VARCHAR(36),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   VARCHAR(36),
    details     JSON,
    ip_address  VARCHAR(45),
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─── ANALYTICS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    snapshot_date   DATE          NOT NULL,
    token_id        VARCHAR(36),
    total_volume    DECIMAL(18,2) DEFAULT 0,
    trade_count     INT           DEFAULT 0,
    unique_traders  INT           DEFAULT 0,
    open_orders     INT           DEFAULT 0,
    price_open      DECIMAL(18,6) DEFAULT 0,
    price_close     DECIMAL(18,6) DEFAULT 0,
    price_high      DECIMAL(18,6) DEFAULT 0,
    price_low       DECIMAL(18,6) DEFAULT 0,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_wallet      ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kyc_user          ON kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status        ON kyc_records(status);
CREATE INDEX IF NOT EXISTS idx_tokens_spv        ON tokens(spv_id);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol     ON tokens(token_symbol);
CREATE INDEX IF NOT EXISTS idx_orders_token      ON orders(token_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_token      ON trades(token_id);
CREATE INDEX IF NOT EXISTS idx_trades_matched    ON trades(matched_at);
CREATE INDEX IF NOT EXISTS idx_proposals_token   ON proposals(token_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_date    ON analytics_snapshots(snapshot_date);

SELECT 'TokenEquityX V2 schema created successfully' AS result;