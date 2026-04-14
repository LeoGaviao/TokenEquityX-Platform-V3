require('dotenv').config();
const db   = require('./pool');
const { v4: uuidv4 } = require('uuid');

/**
 * TokenEquityX V2 — Seed Data
 * Creates sample companies, tokens, investors, orders and trades
 * for local development and demo purposes.
 *
 * Run with: node src/db/seed.js
 */

// ─── HARDHAT TEST WALLETS ─────────────────────────────────────────
// These are the default Hardhat accounts (public keys only — safe to commit)
const WALLETS = [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Account 0 — deployer/admin
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', // Account 1 — issuer 1
  '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', // Account 2 — issuer 2
  '0x90f79bf6eb2c4f870365e785982e1f101e93b906', // Account 3 — investor 1
  '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', // Account 4 — investor 2
  '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', // Account 5 — investor 3
  '0x976ea74026e726554db657fa54763abd0c3a0aa9', // Account 6 — auditor
  '0x14dc79964da2c08b23698b3d3cc7ca32193d9955', // Account 7 — partner
];

async function seed() {
  console.log('🌱 Seeding TokenEquityX V2 database...\n');

  try {
    // ─── CLEAN EXISTING DATA ────────────────────────────────────────
    console.log('🗑️  Cleaning existing data...');
    await db.execute('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'analytics_snapshots', 'audit_logs', 'market_controls',
      'oracle_prices', 'data_submissions', 'valuations',
      'bond_coupons', 'bonds', 'dividend_claims', 'dividend_rounds',
      'trades', 'orders', 'votes', 'proposals',
      'transactions', 'tokens', 'spvs',
      'kyc_documents', 'kyc_records', 'auth_nonces', 'users'
    ];
    for (const table of tables) {
      await db.execute(`DELETE FROM ${table}`);
    }
    await db.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Database cleaned\n');

    // ─── USERS ──────────────────────────────────────────────────────
    console.log('👤 Creating users...');
    const users = [
      { id: uuidv4(), wallet: WALLETS[0], role: 'ADMIN',              kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[1], role: 'ISSUER',             kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[2], role: 'ISSUER',             kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[3], role: 'INVESTOR',           kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[4], role: 'INVESTOR',           kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[5], role: 'INVESTOR',           kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[6], role: 'AUDITOR',            kyc: 'APPROVED' },
      { id: uuidv4(), wallet: WALLETS[7], role: 'PARTNER',            kyc: 'APPROVED' },
    ];

    for (const u of users) {
      await db.execute(
        'INSERT INTO users (id, wallet_address, role, kyc_status) VALUES (?, ?, ?, ?)',
        [u.id, u.wallet, u.role, u.kyc]
      );
    }
    console.log(`✅ Created ${users.length} users\n`);

    // ─── KYC RECORDS ────────────────────────────────────────────────
    console.log('📋 Creating KYC records...');
    const kycData = [
      { userId: users[0].id, name: 'Platform Admin',     country: 'ZW', tier: 'INSTITUTIONAL' },
      { userId: users[1].id, name: 'John Moyo',          country: 'ZW', tier: 'ACCREDITED' },
      { userId: users[2].id, name: 'Sarah Banda',        country: 'ZW', tier: 'ACCREDITED' },
      { userId: users[3].id, name: 'James Ncube',        country: 'ZW', tier: 'RETAIL' },
      { userId: users[4].id, name: 'Grace Mutasa',       country: 'ZW', tier: 'RETAIL' },
      { userId: users[5].id, name: 'David Chikwanda',    country: 'ZW', tier: 'ACCREDITED' },
      { userId: users[6].id, name: 'Auditor Firm Ltd',   country: 'ZW', tier: 'INSTITUTIONAL' },
      { userId: users[7].id, name: 'Partner Analytics',  country: 'ZW', tier: 'INSTITUTIONAL' },
    ];

    for (const k of kycData) {
      await db.execute(`
        INSERT INTO kyc_records
          (id, user_id, full_name, nationality, country,
           investor_tier, status, reviewed_at, expires_at)
        VALUES (?, ?, ?, 'ZW', ?, ?, 'APPROVED', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
      `, [uuidv4(), k.userId, k.name, k.country, k.tier]);
    }
    console.log(`✅ Created ${kycData.length} KYC records\n`);

    // ─── SPVs ───────────────────────────────────────────────────────
    console.log('🏢 Creating SPVs...');
    const spvs = [
      {
        id:      uuidv4(),
        owner:   users[1].id,
        name:    'Acme Corporation Zimbabwe Ltd',
        regNo:   'ZW-PVT-2020-001',
        juris:   'ZW',
        sector:  'TECH',
        type:    'EQUITY',
        desc:    'Leading technology company providing enterprise software solutions across Southern Africa.'
      },
      {
        id:      uuidv4(),
        owner:   users[1].id,
        name:    'Harare Commercial Properties REIT',
        regNo:   'ZW-REIT-2021-001',
        juris:   'ZW',
        sector:  'REAL_ESTATE',
        type:    'REIT',
        desc:    'Diversified commercial real estate investment trust with properties across Harare CBD.'
      },
      {
        id:      uuidv4(),
        owner:   users[2].id,
        name:    'Great Dyke Mining Resources Ltd',
        regNo:   'ZW-MIN-2019-003',
        juris:   'ZW',
        sector:  'MINING',
        type:    'MINING',
        desc:    'Platinum and palladium exploration and production along the Great Dyke geological formation.'
      },
      {
        id:      uuidv4(),
        owner:   users[2].id,
        name:    'Zimbabwe Infrastructure Bond SPV',
        regNo:   'ZW-BOND-2022-001',
        juris:   'ZW',
        sector:  'INFRASTRUCTURE',
        type:    'BOND',
        desc:    '5-year infrastructure development bond financing road and energy projects in Zimbabwe.'
      },
    ];

    for (const s of spvs) {
      await db.execute(`
        INSERT INTO spvs
          (id, owner_user_id, legal_name, registration_number,
           jurisdiction, sector, asset_type, description, kyc_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')
      `, [s.id, s.owner, s.name, s.regNo, s.juris, s.sector, s.type, s.desc]);
    }
    console.log(`✅ Created ${spvs.length} SPVs\n`);

    // ─── TOKENS ─────────────────────────────────────────────────────
    console.log('🪙 Creating tokens...');
    const tokens = [
      {
        id:         uuidv4(),
        spvId:      spvs[0].id,
        name:       'Acme Corporation Equity',
        symbol:     'ACME',
        ticker:     'ACME',
        type:       'EQUITY',
        auth:       '10000000',
        issued:     '2500000',
        nominal:    100,
        price:      5.75,
        state:      'FULL_TRADING',
        status:     'ACTIVE'
      },
      {
        id:         uuidv4(),
        spvId:      spvs[1].id,
        name:       'Harare Properties REIT Token',
        symbol:     'HCPR',
        ticker:     'HCPR',
        type:       'REIT',
        auth:       '5000000',
        issued:     '1000000',
        nominal:    200,
        price:      12.40,
        state:      'FULL_TRADING',
        status:     'ACTIVE'
      },
      {
        id:         uuidv4(),
        spvId:      spvs[2].id,
        name:       'Great Dyke Mining Token',
        symbol:     'GDMR',
        ticker:     'GDMR',
        type:       'MINING',
        auth:       '20000000',
        issued:     '5000000',
        nominal:    50,
        price:      3.20,
        state:      'LIMITED_TRADING',
        status:     'ACTIVE'
      },
      {
        id:         uuidv4(),
        spvId:      spvs[3].id,
        name:       'ZW Infrastructure Bond 2027',
        symbol:     'ZWIB',
        ticker:     'ZWIB',
        type:       'BOND',
        auth:       '1000000',
        issued:     '500000',
        nominal:    1000,
        price:      98.50,
        state:      'P2P_ONLY',
        status:     'ACTIVE'
      },
    ];

    for (const t of tokens) {
      await db.execute(`
        INSERT INTO tokens
          (id, spv_id, token_name, token_symbol, ticker,
           asset_type, authorised_shares, issued_shares,
           nominal_value_cents, current_price_usd,
           market_state, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        t.id, t.spvId, t.name, t.symbol, t.ticker,
        t.type, t.auth, t.issued, t.nominal,
        t.price, t.state, t.status
      ]);
    }
    console.log(`✅ Created ${tokens.length} tokens\n`);

    // ─── BOND RECORD ────────────────────────────────────────────────
    console.log('📄 Creating bond record...');
    await db.execute(`
      INSERT INTO bonds
        (id, token_id, face_value_per_token, coupon_rate_bps,
         coupon_frequency_days, maturity_date, next_coupon_date,
         early_redemption_allowed, early_redemption_penalty_bps, status)
      VALUES (?, ?, 1000.00, 850, 90, '2027-12-31', '2025-06-30', 1, 300, 'ACTIVE')
    `, [uuidv4(), tokens[3].id]);
    console.log('✅ Bond record created\n');

    // ─── ORDERS ─────────────────────────────────────────────────────
    console.log('📈 Creating sample orders...');
    const orderData = [
      // ACME orders
      { token: tokens[0].id, user: users[3].id, side: 'BUY',  qty: 1000,  price: 5.70 },
      { token: tokens[0].id, user: users[4].id, side: 'BUY',  qty: 500,   price: 5.65 },
      { token: tokens[0].id, user: users[5].id, side: 'BUY',  qty: 2000,  price: 5.60 },
      { token: tokens[0].id, user: users[1].id, side: 'SELL', qty: 800,   price: 5.80 },
      { token: tokens[0].id, user: users[1].id, side: 'SELL', qty: 1200,  price: 5.85 },
      { token: tokens[0].id, user: users[1].id, side: 'SELL', qty: 3000,  price: 5.90 },
      // HCPR orders
      { token: tokens[1].id, user: users[3].id, side: 'BUY',  qty: 200,   price: 12.30 },
      { token: tokens[1].id, user: users[4].id, side: 'BUY',  qty: 150,   price: 12.20 },
      { token: tokens[1].id, user: users[2].id, side: 'SELL', qty: 300,   price: 12.50 },
      { token: tokens[1].id, user: users[2].id, side: 'SELL', qty: 200,   price: 12.60 },
      // GDMR orders
      { token: tokens[2].id, user: users[5].id, side: 'BUY',  qty: 5000,  price: 3.15 },
      { token: tokens[2].id, user: users[2].id, side: 'SELL', qty: 3000,  price: 3.25 },
    ];

    for (const o of orderData) {
      await db.execute(`
        INSERT INTO orders
          (id, token_id, user_id, side, order_type,
           quantity, filled_qty, limit_price, status)
        VALUES (?, ?, ?, ?, 'LIMIT', ?, 0, ?, 'OPEN')
      `, [uuidv4(), o.token, o.user, o.side, o.qty, o.price]);
    }
    console.log(`✅ Created ${orderData.length} orders\n`);

    // ─── TRADES ─────────────────────────────────────────────────────
    console.log('⚡ Creating sample trades...');

    // Create placeholder orders for trades
    const buyOrderId  = uuidv4();
    const sellOrderId = uuidv4();

    await db.execute(`
      INSERT INTO orders (id, token_id, user_id, side, order_type, quantity, filled_qty, limit_price, status)
      VALUES (?, ?, ?, 'BUY', 'LIMIT', 500, 500, 5.75, 'FILLED')
    `, [buyOrderId, tokens[0].id, users[3].id]);

    await db.execute(`
      INSERT INTO orders (id, token_id, user_id, side, order_type, quantity, filled_qty, limit_price, status)
      VALUES (?, ?, ?, 'SELL', 'LIMIT', 500, 500, 5.75, 'FILLED')
    `, [sellOrderId, tokens[0].id, users[1].id]);

    const tradeData = [
      { buy: buyOrderId, sell: sellOrderId, token: tokens[0].id, buyer: users[3].id, seller: users[1].id, qty: 500, price: 5.75 },
    ];

    for (const t of tradeData) {
      const total = t.qty * t.price;
      const fee   = total * 0.005;
      await db.execute(`
        INSERT INTO trades
          (id, buy_order_id, sell_order_id, token_id,
           buyer_id, seller_id, quantity, price,
           total_usdc, platform_fee, status, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', NOW())
      `, [uuidv4(), t.buy, t.sell, t.token, t.buyer, t.seller, t.qty, t.price, total, fee]);
    }
    console.log(`✅ Created ${tradeData.length} trades\n`);

    // ─── PROPOSALS ──────────────────────────────────────────────────
    console.log('🗳️  Creating governance proposals...');
    await db.execute(`
      INSERT INTO proposals
        (id, token_id, title, description, resolution_type,
         status, voting_duration, start_time, end_time,
         votes_for, votes_against, votes_abstain, created_by)
      VALUES
        (?, ?, 'Q1 2025 Dividend Approval',
         'Approve payment of $0.15 per share dividend from Q1 2025 profits.',
         'ORDINARY', 'ACTIVE', 7, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY),
         1500000, 250000, 100000, ?)
    `, [uuidv4(), tokens[0].id, users[1].id]);

    await db.execute(`
      INSERT INTO proposals
        (id, token_id, title, description, resolution_type,
         status, voting_duration, start_time, end_time,
         votes_for, votes_against, votes_abstain, created_by)
      VALUES
        (?, ?, 'Board Member Appointment — Dr. N. Sibanda',
         'Appointment of Dr. Nkosi Sibanda as independent non-executive director.',
         'SPECIAL', 'ACTIVE', 14, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY),
         800000, 50000, 25000, ?)
    `, [uuidv4(), tokens[0].id, users[1].id]);
    console.log('✅ Created 2 governance proposals\n');

    // ─── DIVIDEND ROUNDS ────────────────────────────────────────────
    console.log('💰 Creating dividend rounds...');
    await db.execute(`
      INSERT INTO dividend_rounds
        (id, token_id, round_type, description,
         total_amount_usdc, claim_deadline, status)
      VALUES
        (?, ?, 'DIVIDEND', 'Q4 2024 Annual Dividend',
         375000.00, DATE_ADD(NOW(), INTERVAL 30 DAY), 'ACTIVE')
    `, [uuidv4(), tokens[0].id]);

    await db.execute(`
      INSERT INTO dividend_rounds
        (id, token_id, round_type, description,
         total_amount_usdc, claim_deadline, status)
      VALUES
        (?, ?, 'DIVIDEND', 'Q4 2024 Property Income Distribution',
         124000.00, DATE_ADD(NOW(), INTERVAL 30 DAY), 'ACTIVE')
    `, [uuidv4(), tokens[1].id]);
    console.log('✅ Created 2 dividend rounds\n');

    // ─── VALUATIONS ─────────────────────────────────────────────────
    console.log('📊 Creating valuations...');
    const valuations = [
      {
        tokenId: tokens[0].id, spvId: spvs[0].id,
        valuation: 14375000, price: 5.75, method: 'BLENDED',
        revenue: 8500000, ebitda: 2100000, growth: 18, discount: 12
      },
      {
        tokenId: tokens[1].id, spvId: spvs[1].id,
        valuation: 12400000, price: 12.40, method: 'REAL_ESTATE_NAV',
        revenue: null, ebitda: null, growth: null, discount: null
      },
      {
        tokenId: tokens[2].id, spvId: spvs[2].id,
        valuation: 16000000, price: 3.20, method: 'RESOURCE_VALUATION',
        revenue: null, ebitda: null, growth: null, discount: null
      },
    ];

    for (const v of valuations) {
      await db.execute(`
        INSERT INTO valuations
          (id, token_id, spv_id, valuation_usd, price_per_token,
           method, revenue_ttm, ebitda_ttm, growth_rate_pct,
           discount_rate_pct, issued_shares, auditor_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        uuidv4(), v.tokenId, v.spvId, v.valuation, v.price,
        v.method, v.revenue, v.ebitda, v.growth, v.discount,
        2500000
      ]);
    }
    console.log(`✅ Created ${valuations.length} valuations\n`);

    // ─── MARKET CONTROLS ────────────────────────────────────────────
    console.log('⚙️  Creating market controls...');
    for (const t of tokens) {
      await db.execute(`
        INSERT INTO market_controls
          (id, token_id, trading_enabled, halted,
           daily_volume_cap_usd, max_trade_size_usd)
        VALUES (?, ?, 1, 0, 500000.00, 50000.00)
      `, [uuidv4(), t.id]);
    }
    console.log(`✅ Created market controls for ${tokens.length} tokens\n`);

    // ─── ORACLE PRICES ──────────────────────────────────────────────
    console.log('🔮 Creating oracle prices...');
    for (const t of tokens) {
      await db.execute(`
        INSERT INTO oracle_prices
          (id, token_id, price_usd, source, status,
           submitted_by, approved_by, approved_at)
        VALUES (?, ?, ?, 'SEED_DATA', 'APPROVED', ?, ?, NOW())
      `, [uuidv4(), t.id, t.price, users[0].id, users[0].id]);
    }
    console.log(`✅ Created oracle prices for ${tokens.length} tokens\n`);

    // ─── AUDIT LOGS ─────────────────────────────────────────────────
    console.log('📋 Creating audit log entries...');
    const auditEntries = [
      { user: users[0].id, action: 'PLATFORM_SEEDED',         entity: 'system',   id: uuidv4() },
      { user: users[1].id, action: 'ASSET_REGISTERED',        entity: 'token',    id: tokens[0].id },
      { user: users[1].id, action: 'ASSET_REGISTERED',        entity: 'token',    id: tokens[1].id },
      { user: users[2].id, action: 'ASSET_REGISTERED',        entity: 'token',    id: tokens[2].id },
      { user: users[2].id, action: 'ASSET_REGISTERED',        entity: 'token',    id: tokens[3].id },
      { user: users[6].id, action: 'KYC_APPROVED',            entity: 'kyc',      id: uuidv4() },
      { user: users[6].id, action: 'DATA_APPROVED_VALUATION_UPDATED', entity: 'valuation', id: uuidv4() },
    ];

    for (const a of auditEntries) {
      await db.execute(
        'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), a.user, a.action, a.entity, a.id]
      );
    }
    console.log(`✅ Created ${auditEntries.length} audit log entries\n`);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ SEED COMPLETE — TokenEquityX V2 Demo Data');
    console.log('═══════════════════════════════════════════════\n');
    console.log('📋 Summary:');
    console.log(`   Users:        ${users.length}`);
    console.log(`   SPVs:         ${spvs.length}`);
    console.log(`   Tokens:       ${tokens.length} (EQUITY, REIT, MINING, BOND)`);
    console.log(`   Orders:       ${orderData.length} open orders`);
    console.log(`   Trades:       ${tradeData.length} settled trades`);
    console.log(`   Proposals:    2 active governance proposals`);
    console.log(`   Dividends:    2 active distribution rounds`);
    console.log(`   Valuations:   ${valuations.length} auditor-approved\n`);
    console.log('👤 Test Accounts (use with Hardhat node):');
    console.log(`   Admin:     ${WALLETS[0]}`);
    console.log(`   Issuer 1:  ${WALLETS[1]}`);
    console.log(`   Issuer 2:  ${WALLETS[2]}`);
    console.log(`   Investor 1:${WALLETS[3]}`);
    console.log(`   Investor 2:${WALLETS[4]}`);
    console.log(`   Investor 3:${WALLETS[5]}`);
    console.log(`   Auditor:   ${WALLETS[6]}`);
    console.log(`   Partner:   ${WALLETS[7]}`);
    console.log('\n🚀 Ready for demo!\n');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
  } finally {
    process.exit(0);
  }
}

seed();
