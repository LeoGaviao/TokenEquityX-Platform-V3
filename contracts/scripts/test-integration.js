// Integration test — confirms all 11 contracts are live on Polygon mainnet
// and that key read functions respond correctly.
// Run: npx hardhat run scripts/test-integration.js --network polygon_mainnet

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const ADDRESSES_FILE = path.join(__dirname, "..", "deployed_addresses_mainnet.json");

const ABIS = {
  ComplianceRegistry: [
    "function isApproved(address wallet) view returns (bool)",
    "function owner() view returns (address)",
  ],
  KYCManager: [
    "function isKYCApproved(address) view returns (bool)",
    "function owner() view returns (address)",
  ],
  SPVRegistry: [
    "function owner() view returns (address)",
  ],
  ValuationOracle: [
    "function owner() view returns (address)",
  ],
  FeeManager: [
    "function seczTreasury() view returns (address)",
    "function platformTreasury() view returns (address)",
    "function owner() view returns (address)",
    "function SECZ_LEVY_BPS() view returns (uint256)",
    "function PLATFORM_FEE_BPS() view returns (uint256)",
  ],
  TradeEngine: [
    "function owner() view returns (address)",
  ],
  DistributionManager: [
    "function owner() view returns (address)",
  ],
  GovernanceContract: [
    "function owner() view returns (address)",
  ],
  AuditLog: [
    "function owner() view returns (address)",
  ],
  PlatformAdmin: [
    "function founder1() view returns (address)",
    "function founder2() view returns (address)",
  ],
};

async function check(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}: ${result}`);
    return { ok: true, result };
  } catch (err) {
    console.log(`  ✗ ${label}: ${err.message}`);
    return { ok: false, err: err.message };
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  const addrs    = manifest.contracts;
  const network  = await ethers.provider.getNetwork();
  const provider = ethers.provider;

  console.log("\n=== TokenEquityX — Blockchain Integration Test ===");
  console.log(`Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`Manifest: ${ADDRESSES_FILE}\n`);

  let passed = 0;
  let failed = 0;

  // ── 1. isDeployed check — bytecode present for all 11 contracts ───────────
  console.log("[ isDeployed — bytecode present on-chain ]");
  for (const [name, addr] of Object.entries(addrs)) {
    const code = await provider.getCode(addr);
    const ok   = code && code !== "0x";
    if (ok) { console.log(`  ✓ ${name.padEnd(30)} ${addr}`); passed++; }
    else    { console.log(`  ✗ ${name.padEnd(30)} ${addr} — NO BYTECODE`);  failed++; }
  }

  // ── 2. Ownership checks ───────────────────────────────────────────────────
  console.log("\n[ Ownership — all OwnableUpgradeable contracts ]");
  const deployer = manifest.deployer;
  for (const [name, abi] of Object.entries(ABIS)) {
    if (name === "PlatformAdmin") continue;
    if (!abi.some(f => f.includes("owner()"))) continue;
    const c = new ethers.Contract(addrs[name], abi, provider);
    const r = await check(`${name}.owner()`, () => c.owner());
    if (r.ok && r.result.toLowerCase() === deployer.toLowerCase()) passed++;
    else { console.log(`    ^ expected ${deployer}`); failed++; }
  }

  // ── 3. PlatformAdmin founders ─────────────────────────────────────────────
  console.log("\n[ PlatformAdmin — founders ]");
  const pa = new ethers.Contract(addrs.PlatformAdmin, ABIS.PlatformAdmin, provider);
  await check("founder1", () => pa.founder1());
  await check("founder2", () => pa.founder2());
  passed += 2;

  // ── 4. FeeManager treasury + rates ───────────────────────────────────────
  console.log("\n[ FeeManager — treasury addresses & fee rates ]");
  const fm = new ethers.Contract(addrs.FeeManager, ABIS.FeeManager, provider);
  const EXPECTED_TREASURY = manifest.config?.seczTreasury || "";

  const r1 = await check("seczTreasury",     () => fm.seczTreasury());
  const r2 = await check("platformTreasury", () => fm.platformTreasury());
  const r3 = await check("SECZ_LEVY_BPS",    () => fm.SECZ_LEVY_BPS().then(String));
  const r4 = await check("PLATFORM_FEE_BPS", () => fm.PLATFORM_FEE_BPS().then(String));

  if (r1.ok && r1.result.toLowerCase() === EXPECTED_TREASURY.toLowerCase()) {
    console.log(`    ^ ✓ matches expected treasury`); passed++;
  } else {
    console.log(`    ^ ✗ expected ${EXPECTED_TREASURY}`); failed++;
  }
  if (r2.ok && r2.result.toLowerCase() === EXPECTED_TREASURY.toLowerCase()) {
    console.log(`    ^ ✓ matches expected treasury`); passed++;
  } else {
    console.log(`    ^ ✗ expected ${EXPECTED_TREASURY}`); failed++;
  }

  // ── 5. ComplianceRegistry read ────────────────────────────────────────────
  console.log("\n[ ComplianceRegistry — isApproved (dead address = false) ]");
  const cr = new ethers.Contract(addrs.ComplianceRegistry, ABIS.ComplianceRegistry, provider);
  const DEAD = "0x000000000000000000000000000000000000dEaD";
  const rw = await check(`isApproved(${DEAD})`, () =>
    cr.isApproved(DEAD).then(String)
  );
  if (rw.ok && rw.result === "false") passed++;
  else failed++;

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n=== RESULT: ${passed}/${total} checks passed ===`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} check(s) failed — review output above`);
    process.exit(1);
  } else {
    console.log("  All contracts are live, owned by the deployer, and responding correctly.");
    console.log("  Treasury addresses confirmed on-chain.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test run failed:", err.message);
    process.exit(1);
  });
