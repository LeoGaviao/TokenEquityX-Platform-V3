// Polygon PoS mainnet — full clean deployment of all 11 contracts
// Run: npx hardhat run scripts/deploy-all.js --network polygon_mainnet

const { ethers, upgrades } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const FOUNDER_1          = process.env.FOUNDER_1_ADDRESS         || "";
const FOUNDER_2          = process.env.FOUNDER_2_ADDRESS         || "";
const SECZ_TREASURY      = process.env.SECZ_TREASURY_ADDRESS     || "";
const PLATFORM_TREASURY  = process.env.PLATFORM_TREASURY_ADDRESS || "";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log("\n=== TokenEquityX — Polygon PoS Mainnet Deployment ===");
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Network:   ${network.name} (chainId ${network.chainId})`);

  const balanceBefore = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:   ${ethers.formatEther(balanceBefore)} POL\n`);

  if (network.chainId !== 137n) {
    throw new Error(`Wrong network! Expected chainId 137 (Polygon mainnet), got ${network.chainId}`);
  }

  if (balanceBefore < ethers.parseEther("50")) {
    throw new Error(`Low balance (${ethers.formatEther(balanceBefore)} POL). Recommended minimum is 50 POL.`);
  }

  const founder1          = FOUNDER_1          || deployer.address;
  const founder2          = FOUNDER_2          || deployer.address;
  const seczTreasury      = SECZ_TREASURY      || deployer.address;
  const platformTreasury  = PLATFORM_TREASURY  || deployer.address;

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
  console.log(`      ✓ ComplianceRegistry     ${deployed.ComplianceRegistry}`);

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
  console.log(`      ✓ KYCManager             ${deployed.KYCManager}`);

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
  console.log(`      ✓ SPVRegistry            ${deployed.SPVRegistry}`);

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
  console.log(`      ✓ ValuationOracle        ${deployed.ValuationOracle}`);

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
  console.log(`      ✓ FeeManager             ${deployed.FeeManager}`);

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
  console.log(`      ✓ TradeEngine            ${deployed.TradeEngine}`);

  console.log("      Authorising TradeEngine on FeeManager...");
  await (await feeManager.authoriseCaller(deployed.TradeEngine)).wait();
  console.log("      ✓ authoriseCaller done");

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
  console.log(`      ✓ DistributionManager    ${deployed.DistributionManager}`);

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
  console.log(`      ✓ GovernanceContract     ${deployed.GovernanceContract}`);

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
  console.log(`      ✓ AuditLog               ${deployed.AuditLog}`);

  console.log("      Authorising loggers on AuditLog...");
  for (const [name, addr] of [
    ["TradeEngine",          deployed.TradeEngine],
    ["KYCManager",           deployed.KYCManager],
    ["DistributionManager",  deployed.DistributionManager],
    ["GovernanceContract",   deployed.GovernanceContract],
  ]) {
    await (await auditLog.authoriseLogger(addr)).wait();
    console.log(`      ✓ authoriseLogger(${name})`);
  }

  // ── 10. AssetToken implementation ────────────────────────────────────
  console.log("10/11 Deploying AssetToken implementation...");
  const AssetToken     = await ethers.getContractFactory("AssetToken");
  const assetTokenImpl = await AssetToken.deploy();
  await assetTokenImpl.waitForDeployment();
  deployed.AssetTokenImplementation = await assetTokenImpl.getAddress();
  console.log(`      ✓ AssetToken (impl)      ${deployed.AssetTokenImplementation}`);

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
  console.log(`      ✓ PlatformAdmin          ${deployed.PlatformAdmin}`);

  // ── Gas report ────────────────────────────────────────────────────────
  const balanceAfter = await ethers.provider.getBalance(deployer.address);
  const gasUsedPOL   = balanceBefore - balanceAfter;
  console.log(`\n⛽ Gas cost: ${ethers.formatEther(gasUsedPOL)} POL`);
  console.log(`   Balance before: ${ethers.formatEther(balanceBefore)} POL`);
  console.log(`   Balance after:  ${ethers.formatEther(balanceAfter)} POL`);

  // ── Save addresses ────────────────────────────────────────────────────
  const output = {
    network:    "polygon_mainnet",
    chainId:    Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer:   deployer.address,
    gasUsedPOL: ethers.formatEther(gasUsedPOL),
    contracts:  deployed,
  };

  const localPath = path.join(__dirname, "..", "deployed_addresses_mainnet.json");
  fs.writeFileSync(localPath, JSON.stringify(output, null, 2));

  const apiPath = path.join(__dirname, "..", "..", "api", "src", "blockchain");
  if (!fs.existsSync(apiPath)) fs.mkdirSync(apiPath, { recursive: true });
  fs.writeFileSync(
    path.join(apiPath, "contract_addresses.json"),
    JSON.stringify(output, null, 2)
  );

  console.log("\n=== MAINNET DEPLOYMENT COMPLETE ===");
  console.log("\nContract addresses:");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name.padEnd(30)} ${addr}`);
  }
  console.log(`\nSaved to: contracts/deployed_addresses_mainnet.json`);
  console.log(`Copied to: api/src/blockchain/contract_addresses.json`);
  console.log(`\nVerify on Polygonscan:`);
  console.log(`  https://polygonscan.com/address/${deployed.ComplianceRegistry}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });
