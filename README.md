# TokenEquityX Platform V3

## Africa's Digital Capital Market Infrastructure

TokenEquityX is an institutional-grade, multi-asset tokenization and trading platform built for African capital markets. It enables companies to tokenize equity, real estate, mining rights, infrastructure assets, REITs and bonds — with full compliance, governance, dividend distribution and secondary trading.

---

## Quick Install

### Windows
```
install.bat
```

### Linux / Mac
```
chmod +x install.sh
./install.sh
```

### Docker (manual)
```
cp .env.example .env
# Edit .env with your settings
docker compose up --build
```

Then visit: **http://localhost:3000/setup**

---

## Setup Wizard

After installation, the setup wizard guides you through:

1. **System Check** — verifies database, Node.js, configuration
2. **Database Setup** — creates admin account
3. **Platform Config** — name, branding, fee settings
4. **Demo Data** — optionally loads sample assets and users
5. **Launch** — marks setup complete and opens the platform

---

## Default Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001/api |
| MySQL | 3306 | localhost:3306 |
| Hardhat Node | 8545 | http://localhost:8545 |

---

## Platform Features

### Multi-Asset Tokenization
- Equity (company shares)
- Real Estate & REITs
- Mining & Mineral Rights
- Infrastructure Assets
- Bonds & Debt Instruments

### Capital Markets Infrastructure
- KYC/AML compliance enforcement
- On-chain governance (AGM/EGM voting)
- Automated dividend distribution
- Real-time order book trading
- Atomic DVP settlement
- Live price ticker

### Institutional Grade
- UUPS upgradeable smart contracts
- Multi-source price oracle with auditor approval
- Circuit breakers and market controls
- Full audit trail
- Role-based access (Investor/Issuer/Auditor/Admin/Partner)

### Valuation Engine
- DCF (Discounted Cash Flow)
- Revenue & EBITDA multiples
- Real Estate NAV & Cap Rate
- Mining Resource Valuation
- Bond Pricing with Duration
- Infrastructure DCF

---

## Architecture
```
TokenEquityX-Platform-V3/
├── install.bat          ← Windows installer
├── install.sh           ← Linux/Mac installer
├── docker-compose.yml   ← Full platform deployment
├── .env.example         ← Configuration template
├── contracts/           ← Solidity smart contracts (Hardhat)
├── api/                 ← Node.js backend API
└── web/                 ← Next.js frontend
```

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| MockUSDC | Test stablecoin (replace with real USDC on mainnet) |
| ComplianceManager | KYC/AML enforcement on every transfer |
| PriceOracle | Multi-source price feeds with auditor approval |
| AssetToken | UUPS upgradeable ERC-20 for any asset type |
| AssetFactory | Deploys token proxies with SPV metadata |
| GovernanceModule | Token-weighted AGM/EGM voting |
| DividendDistributor | Pull-based USDC dividend distribution |
| DebtManager | Bond lifecycle with redemption escrow |
| ExchangeSettlement | Atomic DVP trade settlement |
| P2PTransferModule | Escrow-based peer-to-peer transfers |
| MarketController | Circuit breakers and volume caps |

---

## Roles

| Role | Access |
|------|--------|
| INVESTOR | Trade, dividends, voting, portfolio |
| ISSUER | Register assets, submit financials, governance, dividends |
| AUDITOR | KYC review, financial data approval, oracle prices |
| ADMIN | Full platform control, user management, market controls |
| PARTNER | Aggregated analytics only (no PII) |

---

## Production Deployment

For production deployment on Polygon mainnet:

1. Update `RPC_URL` in `.env` to your Alchemy/Infura Polygon endpoint
2. Update `CHAIN_ID` to `137` (Polygon mainnet)
3. Replace `MockUSDC` address with real USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
4. Deploy contracts: `npx hardhat run contracts/scripts/deploy.js --network polygon`
5. Update contract addresses in `.env`
6. Deploy frontend to Vercel
7. Deploy API to Railway.app or any Node.js host

---

## Support

Built by TokenEquityX Ltd | Harare, Zimbabwe
info@tokenequityx.com | www.tokenequityx.com

---

*TokenEquityX is a technology platform. All securities offerings are subject to applicable laws and regulations. Users are responsible for compliance with securities laws in their jurisdictions.*
