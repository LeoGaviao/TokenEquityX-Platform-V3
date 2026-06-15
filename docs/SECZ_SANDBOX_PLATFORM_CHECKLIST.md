# TokenEquityX V3 — SECZ Sandbox Pre-Session Checklist

**Version:** 3.0.0  
**Date:** June 2026  
**Session Type:** SECZ Innovation Sandbox — Technical Demonstration  

Mark each item ✅ before the sandbox session begins.

---

## A. Infrastructure & Deployment

- [ ] API server is running and healthy: `GET /api/health` returns `{"status":"ok","version":"3.0.0"}`
- [ ] DATABASE_URL points to production Supabase PostgreSQL
- [ ] POLYGON_RPC_URL is set and responsive
- [ ] RESEND_API_KEY is set; test email sends successfully
- [ ] JWT_SECRET is set (minimum 32 chars); not the example value
- [ ] FRONTEND_URL is set to `https://tokenequityx.co.zw`
- [ ] All 11 contract addresses are in `.env` (COMPLIANCE_REGISTRY_ADDRESS, KYC_MANAGER_ADDRESS, etc.)
- [ ] No `console.log` statements printing private keys or secrets in API logs

---

## B. Database Migrations

- [ ] Run `node api/src/scripts/run-migrations.js` — all statements apply without error
- [ ] Verify `wallet_address` column exists on `users` table
- [ ] Verify `currency` column exists on `deposit_requests` and `withdrawal_requests`
- [ ] Verify `imtt_amount` and `net_amount` columns exist on `withdrawal_requests`
- [ ] Verify `currency` column exists on `reconciliation_logs`
- [ ] Verify `escalation_reason` and `escalated_at` columns exist on `data_submissions`
- [ ] Verify `secz_levy` column exists on `trades`
- [ ] Verify all new `platform_settings` rows exist (run SELECT below):

```sql
SELECT key, value FROM platform_settings
WHERE key IN (
  'usdc_pilot_enabled', 'usdc_omnibus_wallet',
  'usdc_deposit_min_usd', 'usdc_withdrawal_min_usd', 'usdc_imtt_rate',
  'annual_spv_fee_usd', 'ipl_rate', 'partner_commission_rate'
)
ORDER BY key;
```

Expected: 8 rows returned.

---

## C. Platform Settings Verification

Confirm these values in `platform_settings`:

| Key | Expected Value | Verified |
|---|---|---|
| `platform_fee_rate` | `0.0050` | [ ] |
| `secz_levy_rate` | `0.0032` | [ ] |
| `vat_rate` | `0.155` | [ ] |
| `wht_resident_rate` | `0.10` | [ ] |
| `wht_non_resident_rate` | `0.15` | [ ] |
| `cgt_rate` | `0.20` | [ ] |
| `imtt_rate` | `0.02` | [ ] |
| `beneficial_owner_threshold` | `0.10` | [ ] |
| `tier1_min_investment_usd` | `100` | [ ] |
| `tier2_min_investment_usd` | `500` | [ ] |
| `tier3_min_investment_usd` | `10000` | [ ] |
| `annual_spv_fee_usd` | `5000.00` | [ ] |
| `ipl_rate` | `0.00025` | [ ] |
| `partner_commission_rate` | `0.001` | [ ] |
| `usdc_pilot_enabled` | **`false`** | [ ] |
| `reconciliation_variance_threshold_usd` | `1.00` | [ ] |

**CRITICAL:** `usdc_pilot_enabled` must be `false` until formal RBZ written confirmation of SI 99 of 2026 supervisory arrangement is received.

---

## D. User Accounts

- [ ] At least one `ADMIN` account is active and accessible
- [ ] At least one `COMPLIANCE` officer account is active
- [ ] Demo investor account(s) created with approved KYC
- [ ] Demo issuer account created (role = `ISSUER`)
- [ ] No Hardhat test wallet accounts remain in production DB
- [ ] Role assignments verified: `SELECT role, COUNT(*) FROM users GROUP BY role`

### Account Setup Commands (via API):
```bash
# Create staff accounts
POST /api/admin/staff
{ "email": "...", "full_name": "...", "role": "COMPLIANCE" }

# Promote to admin
PUT /api/admin/users/:id/role
{ "role": "ADMIN" }
```

---

## E. Security Checks

- [ ] `/api/setup` is NOT accessible (should return 404)
- [ ] `PUT /api/super-admin/sensitive-setting` rejects requests without valid OTP
- [ ] Auth rate limiter active: 6th signup attempt within 15 min returns 429
- [ ] CORS rejects requests from non-whitelisted origins
- [ ] KYC document uploads are stored in Supabase Storage, not local filesystem
- [ ] `wallet_address` field accepts only valid 0x addresses (40 hex chars)
- [ ] MetaMask connect returns `requires_registration: true` for unknown wallets (no auto-create)

---

## F. Smart Contracts

- [ ] `GET /api/health` blockchain check: confirm RPC is reachable
- [ ] ComplianceRegistry: confirm platform wallet is registered
- [ ] ValuationOracle: at least one NAV update in the last 7 days
- [ ] AuditLog: at least one event recorded since mainnet deployment
- [ ] All 11 proxy addresses match `contracts/deployed_addresses_mainnet.json`

Verify on-chain via Polygonscan: `https://polygonscan.com/address/<address>`

---

## G. End-to-End Flows (Manual Test Before Session)

### G1. Investor Onboarding
- [ ] Register new investor via `/api/auth/signup` (email + full_name + password)
- [ ] Welcome email received
- [ ] Submit KYC documents via `/api/kyc/submit`
- [ ] KYC notification sent to compliance officer
- [ ] Approve KYC via admin panel
- [ ] KYC approval email received by investor

### G2. Asset Tokenisation
- [ ] Issuer submits tokenisation application
- [ ] Compliance fee invoice sent
- [ ] Auditor assigned
- [ ] Audit report uploaded
- [ ] SECZ submission generated
- [ ] Token listed on Polygon

### G3. Trading
- [ ] Investor places buy order
- [ ] Order fills and trade recorded in DB + on-chain
- [ ] Fee breakdown correct: platform fee + SECZ levy + IPL
- [ ] Trade confirmation email received

### G4. Distribution
- [ ] Admin triggers distribution for a token
- [ ] Withholding tax deducted at correct rate (resident vs non-resident)
- [ ] Distribution email received by investor

### G5. Reconciliation
- [ ] Trigger manual reconciliation: `POST /api/admin/reconciliation-preview`
- [ ] No variance exceeds $1.00 threshold
- [ ] Reconciliation audit log updated

---

## H. Email System

- [ ] Welcome email (new investor) ✅
- [ ] KYC submitted (investor) ✅
- [ ] KYC approved (investor) ✅
- [ ] KYC rejected (investor) ✅
- [ ] KYC expiry warning (30 days) ✅
- [ ] Deposit confirmed ✅
- [ ] Withdrawal completed ✅
- [ ] Trade filled ✅
- [ ] Distribution received ✅
- [ ] Issuer application received ✅
- [ ] Issuer token live ✅
- [ ] Reconciliation alert (admin) ✅
- [ ] Integrity check alert (admin) ✅
- [ ] USDC deposit initiated ✅
- [ ] USDC deposit confirmed ✅
- [ ] USDC withdrawal initiated ✅
- [ ] USDC withdrawal completed ✅
- [ ] USDC pilot suspended (broadcast) ✅
- [ ] USDC monthly RBZ report (admin) ✅

---

## I. USDC Pilot — Pre-Activation Checklist (Do NOT activate until RBZ confirmation)

The following must be completed before setting `usdc_pilot_enabled = 'true'`:

- [ ] Written confirmation from RBZ that the supervisory arrangement under SI 99 of 2026 is in force
- [ ] Polygon omnibus wallet address confirmed and funded with test USDC
- [ ] `usdc_omnibus_wallet` platform_setting updated to the live 0x address (via OTP-protected endpoint)
- [ ] On-chain USDC balance reconciliation test: `POST /api/admin/reconciliation-preview` with currency=USDC
- [ ] RESEND sending domain verified so pilot-suspended emails will deliver
- [ ] Legal counsel sign-off that RBZ reporting obligations are understood

Once confirmed, toggle via Admin Panel → Super Admin Settings → USDC Pilot switch (requires OTP).

---

## J. Final Pre-Session Steps

1. [ ] Restart API server with latest code: `pm2 restart tokenequityx-api`
2. [ ] Run migrations: `node api/src/scripts/run-migrations.js`
3. [ ] Verify health: `curl https://api.tokenequityx.co.zw/api/health`
4. [ ] Test login with demo accounts (admin + investor)
5. [ ] Open WebSocket connection and confirm real-time feed works
6. [ ] Brief SECZ team on sandbox objectives and demonstration flow
7. [ ] Confirm screen share and recording consent obtained

---

**Prepared by:** TokenEquityX Development Team  
**Contact:** ventures.gaviao@gmail.com  

*This checklist must be completed by the technical lead before each SECZ sandbox session.*
