const { getProvider, getSigner, RPC_URL, CHAIN_ID } = require('./config');
const { contracts, loadAddresses, ABI }             = require('./contracts');

// ── Helper: check if blockchain is reachable ──────────────────────────────────
async function isConnected() {
  try {
    await getProvider().getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

// ── Helper: check if contracts are deployed ───────────────────────────────────
function isDeployed() {
  const addresses = loadAddresses();
  return !!(addresses.ComplianceRegistry && addresses.TradeEngine);
}

// ── High-level KYC helpers used by API routes ─────────────────────────────────
async function approveKYCOnChain(walletAddress) {
  const kyc = contracts.kycManager(true);
  const tx  = await kyc.setKYCStatus(walletAddress, true);
  await tx.wait();
  const registry = contracts.complianceRegistry(true);
  const tx2 = await registry.whitelist(walletAddress);
  await tx2.wait();
  return { txHash: tx.hash, txHash2: tx2.hash };
}

async function revokeKYCOnChain(walletAddress) {
  const kyc  = contracts.kycManager(true);
  const tx   = await kyc.setKYCStatus(walletAddress, false);
  await tx.wait();
  const registry = contracts.complianceRegistry(true);
  const tx2  = await registry.blacklist(walletAddress);
  await tx2.wait();
  return { txHash: tx.hash, txHash2: tx2.hash };
}

async function isKYCApprovedOnChain(walletAddress) {
  const kyc = contracts.kycManager();
  return kyc.isKYCApproved(walletAddress);
}

// ── High-level oracle helper ───────────────────────────────────────────────────
async function updatePriceOnChain(tokenSymbol, priceUSD) {
  const oracle    = contracts.valuationOracle(true);
  const { ethers } = require('ethers');
  const symbolBytes = ethers.encodeBytes32String(tokenSymbol.slice(0, 31));
  // Price stored as USD × 1e6 (6 decimal places)
  const priceUSD6   = BigInt(Math.round(priceUSD * 1_000_000));
  const tx = await oracle.setPrice(symbolBytes, priceUSD6);
  await tx.wait();
  return { txHash: tx.hash, priceUSD6: priceUSD6.toString() };
}

module.exports = {
  // Config
  getProvider,
  getSigner,
  RPC_URL,
  CHAIN_ID,
  // Contract instances
  contracts,
  loadAddresses,
  ABI,
  // Status
  isConnected,
  isDeployed,
  // High-level helpers
  approveKYCOnChain,
  revokeKYCOnChain,
  isKYCApprovedOnChain,
  updatePriceOnChain,
};
