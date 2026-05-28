const { ethers } = require('ethers');

const RPC_URL  = process.env.RPC_URL  || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';

let _provider = null;
let _signer   = null;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  }
  return _provider;
}

function getSigner() {
  if (!DEPLOYER_PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  if (!_signer) {
    _signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, getProvider());
  }
  return _signer;
}

// Reset cached instances (useful when env vars change in tests)
function reset() {
  _provider = null;
  _signer   = null;
}

module.exports = { getProvider, getSigner, reset, RPC_URL, CHAIN_ID };
