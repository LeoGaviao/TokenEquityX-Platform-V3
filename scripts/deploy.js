const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. MockUSDC
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:          ", await usdc.getAddress());

  // 2. ComplianceManager
  const CM = await ethers.getContractFactory("ComplianceManager");
  const cm = await CM.deploy();
  await cm.waitForDeployment();
  console.log("ComplianceManager: ", await cm.getAddress());

  // 3. PriceOracle
  const PO = await ethers.getContractFactory("PriceOracle");
  const po = await PO.deploy();
  await po.waitForDeployment();
  console.log("PriceOracle:       ", await po.getAddress());

  // 4. AssetFactory (deploys AssetToken implementation internally)
  const AF = await ethers.getContractFactory("AssetFactory");
  const af = await AF.deploy(await cm.getAddress(), await po.getAddress());
  await af.waitForDeployment();
  console.log("AssetFactory:      ", await af.getAddress());

  // 5. GovernanceModule
  const GM = await ethers.getContractFactory("GovernanceModule");
  const gm = await GM.deploy();
  await gm.waitForDeployment();
  console.log("GovernanceModule:  ", await gm.getAddress());

  // 6. DividendDistributor
  const DD = await ethers.getContractFactory("DividendDistributor");
  const dd = await DD.deploy(await usdc.getAddress(), deployer.address);
  await dd.waitForDeployment();
  console.log("DividendDistributor:", await dd.getAddress());

  // 7. DebtManager
  const DM = await ethers.getContractFactory("DebtManager");
  const dm = await DM.deploy(await usdc.getAddress(), deployer.address);
  await dm.waitForDeployment();
  console.log("DebtManager:       ", await dm.getAddress());

  // 8. MarketController
  const MC = await ethers.getContractFactory("MarketController");
  const mc = await MC.deploy();
  await mc.waitForDeployment();
  console.log("MarketController:  ", await mc.getAddress());

  // 9. ExchangeSettlement
  const ES = await ethers.getContractFactory("ExchangeSettlement");
  const es = await ES.deploy(
    await usdc.getAddress(),
    await cm.getAddress(),
    deployer.address,
    deployer.address
  );
  await es.waitForDeployment();
  console.log("ExchangeSettlement:", await es.getAddress());

  // 10. P2PTransferModule
  const P2P = await ethers.getContractFactory("P2PTransferModule");
  const p2p = await P2P.deploy(
    await usdc.getAddress(),
    await cm.getAddress(),
    deployer.address
  );
  await p2p.waitForDeployment();
  console.log("P2PTransferModule: ", await p2p.getAddress());

  // Wire up ExchangeSettlement -> MarketController
  await es.setMarketController(await mc.getAddress());
  console.log("\nMarketController wired to ExchangeSettlement");

  console.log("\n✅ All contracts deployed successfully!");
  console.log("\n─── CONTRACT ADDRESSES ──────────────────────────");
  console.log("USDC:              ", await usdc.getAddress());
  console.log("ComplianceManager: ", await cm.getAddress());
  console.log("PriceOracle:       ", await po.getAddress());
  console.log("AssetFactory:      ", await af.getAddress());
  console.log("GovernanceModule:  ", await gm.getAddress());
  console.log("DividendDistributor:", await dd.getAddress());
  console.log("DebtManager:       ", await dm.getAddress());
  console.log("MarketController:  ", await mc.getAddress());
  console.log("ExchangeSettlement:", await es.getAddress());
  console.log("P2PTransferModule: ", await p2p.getAddress());
  console.log("─────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
