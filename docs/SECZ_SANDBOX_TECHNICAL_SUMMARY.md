# TokenEquityX V3 — SECZ Sandbox Technical Summary

**Document Type:** Technical Platform Overview  
**Prepared For:** Securities and Exchange Commission of Zimbabwe (SECZ) — Innovation Sandbox  
**Platform Version:** V3.0.0  
**Date:** June 2026  
**Classification:** Regulatory Submission — Confidential

---

## 1. Platform Overview

TokenEquityX V3 is a regulated capital markets infrastructure platform enabling the tokenisation of real-world assets (RWA) — primarily Zimbabwean real estate, agri-commodities, and SME equity — into fractional digital securities on the Polygon PoS blockchain.

The platform operates under the anticipated SECZ Innovation Sandbox framework and is designed from the ground up for compliance with the Securities and Exchange Act [Chapter 24:25] and related statutory instruments.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin UUPS upgradeable proxies |
| Blockchain | Polygon PoS (chainId 137) — Ethereum-compatible, low-fee, carbon-neutral |
| Backend API | Node.js 20 + Express.js, PostgreSQL (Supabase), JWT auth |
| Frontend | Next.js 14 (React 18), deployed on Vercel |
| File Storage | Supabase Storage (KYC documents, audit reports) |
| Email | Resend (transactional) — 60+ automated notification templates |
| Websockets | Real-time trade and notification feed |

---

## 3. Smart Contract Architecture (Polygon PoS Mainnet)

All 11 contracts are deployed as UUPS upgradeable proxies. The implementation logic can be upgraded without changing the proxy address, preserving investor holdings.

| Contract | Proxy Address | Purpose |
|---|---|---|
| ComplianceRegistry | `0x63e9B40D1e0dA7946039DC7D8B5ca60cfdA0AD9c` | Maps wallet addresses to KYC tier; gates all transfers |
| KYCManager | `0xd884dA2d04Bb3F5736dd0b86E4077361AE29ab76` | Manages on-chain KYC status records |
| SPVRegistry | `0x4257FD7D14b2DA4561cCd1b5349ED28cc6b041dd` | Registers tokenised SPVs with SECZ-mandated metadata |
| ValuationOracle | `0x7b487A90a7cfBF3bb06ad5c71f1FAB54eA12112e` | Admin-controlled NAV oracle; emits valuation events |
| FeeManager | `0x4D297DB29a25651048601e9df2B8Cab8e45348E1` | Computes and distributes platform fees, SECZ levies, VAT |
| TradeEngine | `0x5980e46570AcC1f795C7240f23ab41F98f34E215` | On-chain order book; enforces compliance gate on fill |
| DistributionManager | `0x6E4236824c15dbea77485d6924f788231a400852` | Distributes dividends and rental income to token holders |
| GovernanceContract | `0x10fCF90241035F059bE4b78d068CcaDf40282BFC` | Token holder voting; governance proposals and resolutions |
| AuditLog | `0x349BA6097BCc5D8c76490d99A3840d730aEb978C` | Immutable on-chain audit trail for key platform events |
| AssetTokenImplementation | `0xbc2139f07D7D677fdC10474d335d8870B8725907` | ERC-20 token template; each tokenised asset gets an instance |
| PlatformAdmin | `0xa5Dd151bb1E5794C6f3F0811cb237973257079a0` | Multi-sig admin control for emergency pause and upgrades |

**Treasury / Omnibus Wallet:** `0x95A6F1E8E066800A4fA79990b658a90163448f5d`

All contracts verified on Polygonscan. Source code available for SECZ review on request.

---

## 4. Regulatory Compliance Features

### 4.1 KYC / AML
- Tiered KYC: Tier 1 (Retail, ≥$100), Tier 2 (Corporate, ≥$500), Tier 3 (Institutional, ≥$10,000)
- Document upload and liveness check via Supabase Storage
- KYC expiry tracking with 30-day advance warning emails
- Beneficial owner declaration for holdings ≥10% (FATF Recommendation 24)
- On-chain KYCManager synced to off-chain approval status

### 4.2 Investor Residency & Tax Withholding
- Withholding tax: 10% (Zimbabwe residents), 15% (non-residents) — deducted at distribution
- Capital Gains Tax: 20% — applied to land-holding entity share disposals
- VAT: 15.5% (Finance Act 2025) — applied to platform fee on new subscriptions
- IMTT: 2% — applied to USDC withdrawals for Zimbabwe-resident investors under SI 99 of 2026

### 4.3 Trading Controls
- All secondary market trades require ComplianceRegistry gate on-chain
- Admin can pause individual tokens or the entire market
- Minimum investment thresholds enforced per investor tier
- SECZ levy (0.32%) and Investor Protection Levy (0.025%) computed and retained on each trade
- Platform fee: 0.50% per trade

### 4.4 USDC Supervised Pilot (SI 99 of 2026)
- USDC (Circle native, 6 decimals, `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) as settlement rail
- Pilot kill switch in platform_settings: `usdc_pilot_enabled` — currently `false`
- Kill switch requires super-admin OTP to toggle; toggling off sends immediate email blast to all affected investors
- Monthly RBZ report auto-generated on 1st of each month at 08:00 CAT
- Daily on-chain reconciliation against omnibus wallet balance at 18:00 CAT

### 4.5 Reconciliation and Audit
- Real-time reconciliation logs with variance threshold alerts ($1.00 default)
- 7-check weekly platform integrity scan (Sunday 06:00 CAT)
- Immutable on-chain AuditLog contract records critical events
- Admin-accessible reconciliation dashboard with fix-and-preview workflow
- All reconciliation emails sent to multi-recipient compliance address

---

## 5. Data Flows

### 5.1 Investor Onboarding Flow
```
Signup (email + full_name mandatory) →
Email verification →
KYC submission (documents uploaded to Supabase) →
KYC review (Compliance officer) →
KYC approved → wallet_address optional link →
Investor wallet created → ready to invest
```

### 5.2 Tokenisation Flow
```
Issuer applies → compliance fee invoice →
Issuer pays fee → auditor assigned →
Auditor submits report → SECZ compliance submission →
SECZ approval → token listed on-chain →
SPVRegistry.registerSPV() → token live for investment
```

### 5.3 Trade Settlement Flow
```
Investor places order (API) →
ComplianceRegistry check (on-chain) →
TradeEngine.fillOrder() →
FeeManager distributes fees →
AuditLog.recordTrade() →
Investor notified via email + WebSocket
```

---

## 6. Security Architecture

| Control | Implementation |
|---|---|
| Authentication | JWT RS256, 30-day expiry, refresh token rotation |
| Rate limiting | 200 req/15min global; 5 req/15min auth endpoints |
| CORS | Whitelist: `tokenequityx.co.zw`, Vercel deployment, localhost |
| Secrets | All in environment variables; no hardcoded keys in source |
| Private keys | DEPLOYER_PRIVATE_KEY in gitignored `.env`; never committed |
| Setup endpoint | `/api/setup` commented out in production `app.js` |
| Helmet.js | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| OTP guard | Sensitive setting changes require time-limited OTP |
| File uploads | Multer — 10MB limit, MIME type allowlist, stored in Supabase |

---

## 7. Infrastructure

- **API hosting:** Railway / Render (Node.js)
- **Database:** Supabase PostgreSQL (row-level security enabled)
- **Frontend:** Vercel (Next.js)
- **Domain:** tokenequityx.co.zw
- **Blockchain RPC:** Polygon public RPC + QuickNode failover
- **Environment variables:** Managed via hosting provider secret store

---

## 8. Regulatory API Endpoints (Summary)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | Public | Investor registration |
| `POST /api/kyc/submit` | Investor | KYC document submission |
| `PUT /api/admin/users/:id/role` | Admin | Role assignment |
| `GET /api/admin/usdc-report` | Admin | USDC pilot report for RBZ |
| `POST /api/admin/run-migrations` | Super Admin | Apply DB migrations |
| `GET /api/admin/reconciliation-audit` | Admin | Reconciliation audit log |
| `GET /api/admin/integrity-check` | Admin | Platform integrity scan |
| `PUT /api/super-admin/sensitive-setting` | Super Admin + OTP | Toggle pilot / change keys |
| `GET /api/settings/public` | Public | Published platform settings |
| `GET /api/health` | Public | Platform liveness check |

Full OpenAPI documentation available in `api/src/routes/wallet/index.js` file header.

---

*This document is prepared for regulatory review purposes. All contract addresses and configuration values are live on Polygon PoS mainnet.*
