// One-shot script — update seczTreasury and platformTreasury on FeeManager (Polygon mainnet)
// Run: npx hardhat run scripts/update-treasury.js --network polygon_mainnet

const { ethers } = require("hardhat");

const FEE_MANAGER_ADDRESS = "0x4D297DB29a25651048601e9df2B8Cab8e45348E1";
const NEW_TREASURY        = "0x95A6F1E8E066800A4fA79990b658a90163448f5d";

const ABI = [
  "function seczTreasury() view returns (address)",
  "function platformTreasury() view returns (address)",
  "function updateSeczTreasury(address newTreasury)",
  "function updatePlatformTreasury(address newTreasury)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`\nSigner:      ${signer.address}`);
  console.log(`FeeManager:  ${FEE_MANAGER_ADDRESS}`);
  console.log(`New treasury: ${NEW_TREASURY}\n`);

  const fee = new ethers.Contract(FEE_MANAGER_ADDRESS, ABI, signer);

  const beforeSecz     = await fee.seczTreasury();
  const beforePlatform = await fee.platformTreasury();
  console.log(`Current seczTreasury:     ${beforeSecz}`);
  console.log(`Current platformTreasury: ${beforePlatform}\n`);

  console.log("Calling updateSeczTreasury...");
  const tx1 = await fee.updateSeczTreasury(NEW_TREASURY);
  console.log(`  tx sent: ${tx1.hash}`);
  await tx1.wait();
  console.log(`  ✓ confirmed`);

  console.log("Calling updatePlatformTreasury...");
  const tx2 = await fee.updatePlatformTreasury(NEW_TREASURY);
  console.log(`  tx sent: ${tx2.hash}`);
  await tx2.wait();
  console.log(`  ✓ confirmed`);

  const afterSecz     = await fee.seczTreasury();
  const afterPlatform = await fee.platformTreasury();
  console.log(`\nVerified seczTreasury:     ${afterSecz}`);
  console.log(`Verified platformTreasury: ${afterPlatform}`);

  if (afterSecz !== NEW_TREASURY || afterPlatform !== NEW_TREASURY) {
    throw new Error("On-chain values do not match expected treasury address!");
  }

  console.log("\n✓ Both treasury addresses updated and verified on-chain.");
  console.log(`\nPolygonscan links:`);
  console.log(`  https://polygonscan.com/tx/${tx1.hash}`);
  console.log(`  https://polygonscan.com/tx/${tx2.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err.message);
    process.exit(1);
  });
