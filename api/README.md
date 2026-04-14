# TokenEquityX V2 — Backend API

Africa's Digital Capital Market — Institutional Multi-Asset Tokenization Platform

## Quick Start (Local Development)

### Prerequisites
- Node.js v20+
- XAMPP (MySQL)
- MetaMask browser extension

### 1. Database Setup
- Start XAMPP MySQL
- Open phpMyAdmin at http://localhost/phpmyadmin
- Run `src/db/schema.sql` in the SQL tab

### 2. Environment Setup
```
cp .env.example .env
```
Edit `.env` with your values.

### 3. Install & Run
```
npm install
node app.js
```

### 4. Seed Demo Data
```
node src/db/seed.js
```

### 5. Start Frontend
```
cd ../tokenequityx-web-v2
npm install
npm run dev
```

Visit http://localhost:3000

---

## Docker Deployment
```
docker-compose up --build
```

Visit http://localhost:3000

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/health | Health check |
| GET | /api/auth/nonce | Get login nonce |
| POST | /api/auth/login | MetaMask login |
| GET | /api/auth/me | Current user |
| POST | /api/kyc/submit | Submit KYC |
| GET | /api/kyc/status | KYC status |
| POST | /api/assets/register | Register asset |
| GET | /api/assets/all | List all assets |
| POST | /api/governance/proposals | Create proposal |
| POST | /api/governance/vote | Cast vote |
| POST | /api/dividends/create | Create dividend round |
| POST | /api/dividends/claim | Claim dividend |
| POST | /api/trading/order | Place order |
| GET | /api/trading/orderbook/:symbol | Order book |
| POST | /api/bonds/register | Register bond |
| GET | /api/ticker | Live ticker |
| POST | /api/valuation/calculate | Run valuation |
| POST | /api/pipeline/submit | Submit financials |
| PUT | /api/pipeline/approve/:id | Approve data |
| GET | /api/auditor/queue | Review queue |
| GET | /api/admin/stats | Platform stats |

---

## Test Accounts (Hardhat)

| Role | Wallet |
|------|--------|
| Admin | 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 |
| Issuer 1 | 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 |
| Issuer 2 | 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc |
| Investor 1 | 0x90f79bf6eb2c4f870365e785982e1f101e93b906 |
| Investor 2 | 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 |
| Auditor | 0x976ea74026e726554db657fa54763abd0c3a0aa9 |
| Partner | 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 |

---

## Architecture
```
tokenequityx-api-v2/
├── app.js                 ← Main server + WebSocket
├── docker-compose.yml     ← Docker deployment
├── Dockerfile.api         ← API container
└── src/
    ├── db/
    │   ├── pool.js        ← MySQL connection
    │   ├── schema.sql     ← 17 tables
    │   └── seed.js        ← Demo data
    ├── middleware/
    │   ├── auth.js        ← JWT verification
    │   ├── roles.js       ← Role-based access
    │   └── upload.js      ← File uploads
    ├── routes/            ← 13 route files
    ├── services/
    │   ├── websocket.js   ← Real-time events
    │   ├── matching.js    ← Order matching engine
    │   ├── valuation.js   ← 6 valuation models
    │   └── dataHash.js    ← On-chain hash generation
    └── utils/
        └── logger.js      ← Request logging
```

---

## Smart Contracts (TokenEquityX-V2)

| Contract | Purpose |
|----------|---------|
| MockUSDC | Test stablecoin |
| ComplianceManager | KYC/AML enforcement |
| PriceOracle | Multi-source price feeds |
| AssetToken | UUPS upgradeable ERC-20 |
| AssetFactory | Deploys token proxies |
| GovernanceModule | On-chain voting |
| DividendDistributor | Pull-based dividends |
| DebtManager | Bond lifecycle + escrow |
| ExchangeSettlement | Atomic DVP settlement |
| P2PTransferModule | Escrow-based P2P trades |
| MarketController | Circuit breakers |

---

Built by Leo Gaviao | TokenEquityX Ltd | Harare, Zimbabwe
