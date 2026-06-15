// api/src/services/travelRule.js
// Travel Rule compliance — SI 99 of 2026, Part V, Sections 17-20
// Money Laundering and Proceeds of Crime (VASP Registration) Regulations, 2026
// Administered by the Financial Intelligence Unit (FIU), Reserve Bank of Zimbabwe.
//
// As Ordering VASP, TokenEquityX must obtain, verify and retain:
//   Originator: full name, wallet address, ID number, DOB, address (Section 18(1)(a))
//   Beneficiary: full name, wallet address, country and city (Section 18(1)(b))
//
// Records are stored in travel_rule_records and the IVMS 101 payload is retained
// for FIU examination on request.

const VASP_REFERENCE     = 'TOKENEQUITYX-ZW';
const REGULATORY_BASIS   = 'SI 99 of 2026 — Money Laundering and Proceeds of Crime (VASP Registration) Regulations, 2026';

async function recordTravelRule(db, params) {
  const {
    transactionId,
    transactionType,
    originatorUserId,
    beneficiaryWallet,
    beneficiaryName,
    beneficiaryCountry,
    beneficiaryCity,
    amountUsd,
    currency = 'USD',
  } = params;

  // Fetch originator details from users + KYC records
  const [rows] = await db.execute(
    `SELECT
       u.full_name,
       u.wallet_address,
       k.id_number         AS national_id,
       k.date_of_birth,
       k.country_of_residence,
       k.city
     FROM users u
     LEFT JOIN kyc_records k ON k.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [originatorUserId]
  );
  const orig = rows[0] || {};

  const ivms101 = {
    originator: {
      name:                orig.full_name,
      walletAddress:       orig.wallet_address,
      nationalId:          orig.national_id,
      dateOfBirth:         orig.date_of_birth,
      countryOfResidence:  orig.country_of_residence,
      city:                orig.city,
    },
    beneficiary: {
      name:    beneficiaryName,
      walletAddress: beneficiaryWallet,
      country: beneficiaryCountry,
      city:    beneficiaryCity,
    },
    transferAmount: amountUsd,
    currency,
    vaspReference:    VASP_REFERENCE,
    regulatoryBasis:  REGULATORY_BASIS,
  };

  await db.execute(
    `INSERT INTO travel_rule_records (
       transaction_id, transaction_type,
       originator_user_id, originator_full_name,
       originator_wallet, originator_id_number,
       originator_dob, originator_country, originator_city,
       beneficiary_name, beneficiary_wallet,
       beneficiary_country, beneficiary_city,
       amount_usd, currency, vasp_reference,
       ivms_101_payload
     ) VALUES (
       ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
     )`,
    [
      transactionId,      transactionType,
      originatorUserId,   orig.full_name || 'Unknown',
      orig.wallet_address || null,    orig.national_id || null,
      orig.date_of_birth || null,     orig.country_of_residence || null,
      orig.city || null,
      beneficiaryName || null,        beneficiaryWallet || null,
      beneficiaryCountry || null,     beneficiaryCity || null,
      amountUsd,          currency,
      VASP_REFERENCE,
      JSON.stringify(ivms101),
    ]
  );

  return ivms101;
}

// SI 99 Section 20 — transfers to unhosted wallets >= USD 1,000 require
// Wallet Ownership Proof. All external wallets are treated as unhosted unless
// they match a known VASP/custodian address confirmed via formal partnership.
function getUnhostedWalletFlag(wallet) {
  const knownVaspWallets = [
    // Add confirmed custodian/exchange omnibus wallet addresses here
    // e.g. '0x...' when NMB Bank omnibus wallet is confirmed
  ];
  return !knownVaspWallets.includes((wallet || '').toLowerCase());
}

module.exports = { recordTravelRule, getUnhostedWalletFlag };
