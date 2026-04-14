const { ethers, upgrades } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Founder wallets (update before deploying to mainnet) ──────────────────
// founder1 = Richard Chimuka (CEO) — MetaMask wallet address
// founder2 = Leo Gaviao (CTO)     — MetaMask wallet address (deployer)
const FOUNDER_1 = process.env.FOUNDER_1_ADDRESS || "";
const FOUNDER_2 = process.env.FOUNDER_2_ADDRESS || "";

// SECZ treasury — where SECZ levies are tracked (use platform admin wallet for now)
const SECZ_TREASURY     = process.env.SECZ_TREASURY_ADDRESS     || "";
const PLATFORM_TREASURY = process.env.PLATFORM_TREASURY_ADDRESS || "";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== TokenEquityX Smart Contract Deployment ===");
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Network:   ${(await ethers.provider.getNetwork()).name}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} POL\n`);

  const founder1 = FOUNDER_1 || deployer.address;
  const founder2 = FOUNDER_2 || deployer.address;
  const seczTreasury     = SECZ_TREASURY     || deployer.address;
  const platformTreasury = PLATFORM_TREASURY || deployer.address;

  const deployed = {};

  // ── 1. ComplianceRegistry ─────────────────────────────────────────────
  console.log("1/11 Deploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const complianceRegistry = await upgrades.deployProxy(
    ComplianceRegistry,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await complianceRegistry.waitForDeployment();
  deployed.ComplianceRegistry = await complianceRegistry.getAddress();
  console.log(`      ✓ ComplianceRegistry: ${deployed.ComplianceRegistry}`);

  // ── 2. KYCManager ────────────────────────────────────────────────────
  console.log("2/11 Deploying KYCManager...");
  const KYCManager = await ethers.getContractFactory("KYCManager");
  const kycManager = await upgrades.deployProxy(
    KYCManager,
    [deployer.address, deployed.ComplianceRegistry],
    { initializer: "initialize", kind: "uups" }
  );
  await kycManager.waitForDeployment();
  deployed.KYCManager = await kycManager.getAddress();
  console.log(`      ✓ KYCManager: ${deployed.KYCManager}`);

  // ── 3. SPVRegistry ────────────────────────────────────────────────────
  console.log("3/11 Deploying SPVRegistry...");
  const SPVRegistry = await ethers.getContractFactory("SPVRegistry");
  const spvRegistry = await upgrades.deployProxy(
    SPVRegistry,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await spvRegistry.waitForDeployment();
  deployed.SPVRegistry = await spvRegistry.getAddress();
  console.log(`      ✓ SPVRegistry: ${deployed.SPVRegistry}`);

  // ── 4. ValuationOracle ───────────────────────────────────────────────
  console.log("4/11 Deploying ValuationOracle...");
  const ValuationOracle = await ethers.getContractFactory("ValuationOracle");
  const valuationOracle = await upgrades.deployProxy(
    ValuationOracle,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await valuationOracle.waitForDeployment();
  deployed.ValuationOracle = await valuationOracle.getAddress();
  console.log(`      ✓ ValuationOracle: ${deployed.ValuationOracle}`);

  // ── 5. FeeManager ────────────────────────────────────────────────────
  console.log("5/11 Deploying FeeManager...");
  const FeeManager = await ethers.getContractFactory("FeeManager");
  const feeManager = await upgrades.deployProxy(
    FeeManager,
    [deployer.address, seczTreasury, platformTreasury],
    { initializer: "initialize", kind: "uups" }
  );
  await feeManager.waitForDeployment();
  deployed.FeeManager = await feeManager.getAddress();
  console.log(`      ✓ FeeManager: ${deployed.FeeManager}`);

  // ── 6. TradeEngine ───────────────────────────────────────────────────
  console.log("6/11 Deploying TradeEngine...");
  const TradeEngine = await ethers.getContractFactory("TradeEngine");
  const tradeEngine = await upgrades.deployProxy(
    TradeEngine,
    [deployer.address, deployed.ComplianceRegistry, deployed.FeeManager],
    { initializer: "initialize", kind: "uups" }
  );
  await tradeEngine.waitForDeployment();
  deployed.TradeEngine = await tradeEngine.getAddress();
  console.log(`      ✓ TradeEngine: ${deployed.TradeEngine}`);

  // Authorise TradeEngine to call FeeManager
  console.log("      Authorising TradeEngine on FeeManager...");
  await (await feeManager.authoriseCaller(deployed.TradeEngine)).wait();

  // ── 7. DistributionManager ───────────────────────────────────────────
  console.log("7/11 Deploying DistributionManager...");
  const DistributionManager = await ethers.getContractFactory("DistributionManager");
  const distributionManager = await upgrades.deployProxy(
    DistributionManager,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await distributionManager.waitForDeployment();
  deployed.DistributionManager = await distributionManager.getAddress();
  console.log(`      ✓ DistributionManager: ${deployed.DistributionManager}`);

  // ── 8. GovernanceContract ────────────────────────────────────────────
  console.log("8/11 Deploying GovernanceContract...");
  const GovernanceContract = await ethers.getContractFactory("GovernanceContract");
  const governanceContract = await upgrades.deployProxy(
    GovernanceContract,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await governanceContract.waitForDeployment();
  deployed.GovernanceContract = await governanceContract.getAddress();
  console.log(`      ✓ GovernanceContract: ${deployed.GovernanceContract}`);

  // ── 9. AuditLog ──────────────────────────────────────────────────────
  console.log("9/11 Deploying AuditLog...");
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await upgrades.deployProxy(
    AuditLog,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await auditLog.waitForDeployment();
  deployed.AuditLog = await auditLog.getAddress();
  console.log(`      ✓ AuditLog: ${deployed.AuditLog}`);

  // Authorise all contracts to write to AuditLog
  for (const addr of [
    deployed.TradeEngine,
    deployed.KYCManager,
    deployed.DistributionManager,
    deployed.GovernanceContract,
  ]) {
    await (await auditLog.authoriseLogger(addr)).wait();
  }
  console.log("      Authorised all contracts on AuditLog");

  // ── 10. AssetToken (implementation only — instances deployed per listing) ─
  console.log("10/11 Deploying AssetToken implementation...");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const assetTokenImpl = await AssetToken.deploy();
  await assetTokenImpl.waitForDeployment();
  deployed.AssetTokenImplementation = await assetTokenImpl.getAddress();
  console.log(`      ✓ AssetToken implementation: ${deployed.AssetTokenImplementation}`);

  // ── 11. PlatformAdmin ────────────────────────────────────────────────
  console.log("11/11 Deploying PlatformAdmin...");
  const PlatformAdmin = await ethers.getContractFactory("PlatformAdmin");
  const platformAdmin = await upgrades.deployProxy(
    PlatformAdmin,
    [founder1, founder2],
    { initializer: "initialize", kind: "uups" }
  );
  await platformAdmin.waitForDeployment();
  deployed.PlatformAdmin = await platformAdmin.getAddress();
  console.log(`      ✓ PlatformAdmin: ${deployed.PlatformAdmin}`);

  // ── Save deployment addresses ─────────────────────────────────────────
  const outputPath = path.join(__dirname, "deployed_addresses.json");
  const output = {
    network:     (await ethers.provider.getNetwork()).name,
    chainId:     Number((await ethers.provider.getNetwork()).chainId),
    deployedAt:  new Date().toISOString(),
    deployer:    deployer.address,
    contracts:   deployed,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  // ── Also save to api/src/blockchain/ for backend integration ──────────
  const apiPath = path.join(__dirname, "..", "api", "src", "blockchain");
  if (!fs.existsSync(apiPath)) fs.mkdirSync(apiPath, { recursive: true });
  fs.writeFileSync(
    path.join(apiPath, "contract_addresses.json"),
    JSON.stringify(output, null, 2)
  );

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`Addresses saved to: deployed_addresses.json`);
  console.log(`Addresses copied to: api/src/blockchain/contract_addresses.json`);
  console.log("\nContract addresses:");
  for (const [name, address] of Object.entries(deployed)) {
    console.log(`  ${name.padEnd(30)} ${address}`);
  }
  console.log("\nVerify on Polygonscan:");
  console.log(`  https://polygonscan.com/address/${deployed.ComplianceRegistry}`);
  console.log("\n⚠️  Next steps:");
  console.log("  1. Add POLYGON_MAINNET_RPC_URL and DEPLOYER_PRIVATE_KEY to api/.env");
  console.log("  2. Run: npm run wire-blockchain (from api folder)");
  console.log("  3. Approve your admin wallet as KYC in ComplianceRegistry");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });
