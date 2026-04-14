const crypto = require('crypto');

/**
 * Generate a deterministic SHA-256 hash of financial data
 * Used for on-chain verification via PriceOracle
 */
function generateDataHash(data) {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return '0x' + crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validate that submitted data matches a stored hash
 */
function validateDataHash(data, expectedHash) {
  const actual = generateDataHash(data);
  return actual === expectedHash;
}

/**
 * Generate submission ID — incrementing per token
 */
function generateSubmissionId(tokenSymbol, count) {
  return `${tokenSymbol}-SUB-${String(count).padStart(6, '0')}`;
}

module.exports = { generateDataHash, validateDataHash, generateSubmissionId };
