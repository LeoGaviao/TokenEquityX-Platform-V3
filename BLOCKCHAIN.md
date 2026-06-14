# TokenEquityX — Blockchain Layer

Smart contracts deployed on **Polygon PoS Mainnet (chainId 137)** as an additional
settlement and compliance layer. The centralised PostgreSQL ledger remains the primary
source of truth; blockchain calls are non-blocking and never roll back a trade or KYC
decision if the chain is temporarily unreachable.

---

## Deployed Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ComplianceRegistry | `0x63e9B40D1e0dA7946039DC7D8B5ca60cfdA0AD9c` | Wallet whitelist / blacklist |
| KYCManager | `0xd884dA2d04Bb3F5736dd0b86E4077361AE29ab76` | KYC status + expiry per wallet |
| SPVRegistry | `0x4257FD7D14b2DA4561cCd1b5349ED28cc6b041dd` | SPV / issuer registration |
| ValuationOracle | `0x7b487A90a7cfBF3bb06ad5c71f1FAB54eA12112e` | Token price feeds (USD × 1e6) |
| FeeManager | `0x4D297DB29a25651048601e9df2B8Cab8e45348E1` | Fee accounting and treasury |
| TradeEngine | `0x5980e46570AcC1f795C7240f23ab41F98f34E215` | On-chain trade settlement records |
| DistributionManager | `0x6E4236824c15dbea77485d6924f788231a400852` | Dividend / yield distribution |
| GovernanceContract | `0x10fCF90241035F059bE4b78d068CcaDf40282BFC` | Token-holder governance proposals |
| AuditLog | `0x349BA6097BCc5D8c76490d99A3840d730aEb978C` | Immutable audit trail |
| AssetToken (impl) | `0xbc2139f07D7D677fdC10474d335d8870B8725907` | ERC-20 asset token implementation |
| PlatformAdmin | `0xa5Dd151bb1E5794C6f3F0811cb237973257079a0` | Founder multisig governance |

**Deployer:** `0x02A6Db3c08fC2ec03160e63661C05D50bB379580`  
**Deployed:** 2026-06-14 · Gas cost: **5.32 POL**  
**Full manifest:** `contracts/deployed_addresses_mainnet.json`

---

## Treasury Addresses

Both treasury slots on FeeManager updated 2026-06-14:

| Slot | Address |
|------|---------|
| seczTreasury | `0x95A6F1E8E066800A4fA79990b658a90163448f5d` |
| platformTreasury | `0x95A6F1E8E066800A4fA79990b658a90163448f5d` |

Update txs:
- `0x25f153943c927aa64988c3854a032941d0efb7e044004434e3651650afb6b9f7` (seczTreasury)
- `0xecc86ba32fcffaecfe69db3774b3025b4eaa657233c0fcfb70700810be8e2f33` (platformTreasury)

To update treasury again (owner-only):
```
cd contracts
npx hardhat run scripts/update-treasury.js --network polygon_mainnet
```

---

## Architecture

All contracts use **OpenZeppelin UUPS Upgradeable Proxies** — the proxy address never
changes; only the implementation behind it can be upgraded by the owner.

```
API Server (Node.js)
    │
    ├── api/src/blockchain/index.js      ← high-level helpers
    ├── api/src/blockchain/contracts.js  ← ABI + address loader
    ├── api/src/blockchain/config.js     ← provider / signer
    └── api/src/blockchain/contract_addresses.json  ← address manifest
            │
            ▼
    Alchemy RPC (polygon-mainnet.g.alchemy.com)
            │
            ▼
    Polygon PoS Mainnet (chainId 137)
            │
    ┌───────┼───────────────────────────┐
    │       │                           │
  KYCManager  ValuationOracle      FeeManager
  (+ ComplianceRegistry internally)
```

---

## API Integration Points

### KYC Approval → on-chain (non-blocking)

**Triggered by:** `PUT /api/kyc/approve/:kycId` and `PUT /api/entity-kyc/:id/approve`

```js
// After DB commit — fire-and-forget
blockchain.approveKYCOnChain(walletAddress)
  .catch(e => console.error('[BLOCKCHAIN] approveKYCOnChain skipped:', e.message));
```

Calls `KYCManager.approveKYC(wallet, 'RETAIL', 'ZW', 365)` which internally calls
`ComplianceRegistry.approveWallet(wallet)` — one transaction covers both.

### KYC Revocation → on-chain (non-blocking)

**Triggered by:** `PUT /api/kyc/reject/:kycId` and `PUT /api/entity-kyc/:id/reject`

```js
blockchain.revokeKYCOnChain(walletAddress)
  .catch(e => console.error('[BLOCKCHAIN] revokeKYCOnChain skipped:', e.message));
```

Calls `KYCManager.revokeKYC(wallet, 'Compliance revocation')`.

### Oracle Price → on-chain (non-blocking)

**Triggered by:** `PUT /api/auditor/data-submissions/:id/approve`

```js
blockchain.updatePriceOnChain(tokenSymbol, pricePerToken)
  .catch(e => console.error('[BLOCKCHAIN] updatePriceOnChain skipped:', e.message));
```

Calls `ValuationOracle.setPrice(bytes32Symbol, priceUSD × 1e6)`.

---

## FeeManager Rates (immutable constants)

| Fee | BPS | % |
|-----|-----|---|
| SECZ Levy | 32 | 0.32% |
| Platform Fee | 50 | 0.50% |
| Issuance Fee | 200 | 2.00% |

---

## Render Environment Variables

Set these in your Render service environment:

| Variable | Value |
|----------|-------|
| `RPC_URL` | `https://polygon-mainnet.g.alchemy.com/v2/<YOUR_KEY>` |
| `CHAIN_ID` | `137` |
| `DEPLOYER_PRIVATE_KEY` | *(secret — deployer wallet key)* |
| `SECZ_TREASURY_ADDRESS` | `0x95A6F1E8E066800A4fA79990b658a90163448f5d` |
| `PLATFORM_TREASURY_ADDRESS` | `0x95A6F1E8E066800A4fA79990b658a90163448f5d` |

Contract addresses do **not** need to be Render env vars — they are read from the
committed `api/src/blockchain/contract_addresses.json` at startup.

---

## Running the Integration Test

```bash
cd contracts
npx hardhat run scripts/test-integration.js --network polygon_mainnet
```

Expected output: **25/25 checks passed**

Checks: bytecode present for all 11 contracts · all OwnableUpgradeable contracts owned
by deployer · PlatformAdmin founders · FeeManager treasury addresses match config ·
ComplianceRegistry `isApproved` responds correctly.

---

## Re-deploying / Upgrading

**Full redeploy (clean slate):**
```bash
cd contracts
npx hardhat run scripts/deploy-all.js --network polygon_mainnet
```

**Upgrade a single contract (UUPS):**
```js
const { upgrades } = require("hardhat");
const NewImpl = await ethers.getContractFactory("ContractName");
await upgrades.upgradeProxy(PROXY_ADDRESS, NewImpl);
```
The proxy address stays the same. OpenZeppelin state is tracked in
`contracts/.openzeppelin/polygon.json`.

---

## Polygonscan

- ComplianceRegistry: https://polygonscan.com/address/0x63e9B40D1e0dA7946039DC7D8B5ca60cfdA0AD9c
- FeeManager: https://polygonscan.com/address/0x4D297DB29a25651048601e9df2B8Cab8e45348E1
- KYCManager: https://polygonscan.com/address/0xd884dA2d04Bb3F5736dd0b86E4077361AE29ab76
- ValuationOracle: https://polygonscan.com/address/0x7b487A90a7cfBF3bb06ad5c71f1FAB54eA12112e
- PlatformAdmin: https://polygonscan.com/address/0xa5Dd151bb1E5794C6f3F0811cb237973257079a0
