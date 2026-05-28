const { ethers } = require('ethers');
const path = require('path');
const fs   = require('fs');
const { getProvider, getSigner } = require('./config');

// ── Minimal ABIs (only functions the API calls directly) ─────────────────────

const ABI = {
  ComplianceRegistry: [
    'function isWhitelisted(address investor) view returns (bool)',
    'function whitelist(address investor)',
    'function blacklist(address investor)',
    'event Whitelisted(address indexed investor)',
    'event Blacklisted(address indexed investor)',
  ],
  KYCManager: [
    'function isKYCApproved(address investor) view returns (bool)',
    'function setKYCStatus(address investor, bool approved)',
    'function getKYCExpiry(address investor) view returns (uint256)',
    'event KYCApproved(address indexed investor)',
    'event KYCRevoked(address indexed investor)',
  ],
  ValuationOracle: [
    'function setPrice(bytes32 tokenSymbol, uint256 priceUSD6) returns (bool)',
    'function getPrice(bytes32 tokenSymbol) view returns (uint256 priceUSD6, uint256 updatedAt)',
    'event PriceUpdated(bytes32 indexed tokenSymbol, uint256 price)',
  ],
  FeeManager: [
    'function calculateTradeFee(uint256 amountUSD6) view returns (uint256)',
    'function authoriseCaller(address caller)',
    'function getPlatformFeeBps() view returns (uint16)',
  ],
  TradeEngine: [
    'function executeTrade(address seller, address buyer, bytes32 tokenSymbol, uint256 tokenAmount, uint256 priceUSD6) returns (bytes32 tradeId)',
    'event TradeExecuted(bytes32 indexed tradeId, address seller, address buyer, bytes32 tokenSymbol, uint256 amount, uint256 price)',
  ],
  DistributionManager: [
    'function distribute(bytes32 tokenSymbol, address[] calldata recipients, uint256[] calldata amounts)',
    'function claimDistribution(bytes32 tokenSymbol) returns (uint256)',
    'function pendingDistribution(bytes32 tokenSymbol, address investor) view returns (uint256)',
    'event DistributionCreated(bytes32 indexed tokenSymbol, uint256 totalAmount)',
    'event DistributionClaimed(bytes32 indexed tokenSymbol, address indexed investor, uint256 amount)',
  ],
  GovernanceContract: [
    'function propose(bytes32 tokenSymbol, string calldata description, uint256 votingEndTime) returns (uint256 proposalId)',
    'function vote(uint256 proposalId, bool support)',
    'function getProposal(uint256 proposalId) view returns (bytes32 tokenSymbol, string description, uint256 forVotes, uint256 againstVotes, uint256 endTime, bool executed)',
    'event ProposalCreated(uint256 indexed proposalId, bytes32 tokenSymbol)',
    'event Voted(uint256 indexed proposalId, address indexed voter, bool support)',
  ],
  PlatformAdmin: [
    'function isFounder(address account) view returns (bool)',
    'function isPlatformAdmin(address account) view returns (bool)',
    'function addAdmin(address account)',
    'function removeAdmin(address account)',
  ],
  SPVRegistry: [
    'function registerSPV(bytes32 tokenSymbol, address issuer, string calldata entityName)',
    'function getSPV(bytes32 tokenSymbol) view returns (address issuer, string entityName, bool active)',
    'function deactivateSPV(bytes32 tokenSymbol)',
  ],
  AuditLog: [
    'function log(string calldata action, bytes32 ref, address actor)',
    'function authoriseLogger(address logger)',
    'event AuditEntry(uint256 indexed seq, string action, bytes32 ref, address actor, uint256 timestamp)',
  ],
};

// ── Address loader ────────────────────────────────────────────────────────────

function loadAddresses() {
  const filePath = path.join(__dirname, 'contract_addresses.json');
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.contracts || {};
  } catch {
    return {};
  }
}

// ── Contract instance factory ─────────────────────────────────────────────────

function getContract(name, withSigner = false) {
  const addresses = loadAddresses();
  const address   = addresses[name];
  if (!address) throw new Error(`Contract ${name} not deployed — run the deployment script first`);
  const runner = withSigner ? getSigner() : getProvider();
  return new ethers.Contract(address, ABI[name], runner);
}

// ── Named exports for each contract ──────────────────────────────────────────

const contracts = {
  complianceRegistry: (write = false) => getContract('ComplianceRegistry', write),
  kycManager:         (write = false) => getContract('KYCManager', write),
  valuationOracle:    (write = false) => getContract('ValuationOracle', write),
  feeManager:         (write = false) => getContract('FeeManager', write),
  tradeEngine:        (write = false) => getContract('TradeEngine', write),
  distributionManager:(write = false) => getContract('DistributionManager', write),
  governanceContract: (write = false) => getContract('GovernanceContract', write),
  platformAdmin:      (write = false) => getContract('PlatformAdmin', write),
  spvRegistry:        (write = false) => getContract('SPVRegistry', write),
  auditLog:           (write = false) => getContract('AuditLog', write),
};

module.exports = { contracts, loadAddresses, ABI };
