// api/src/utils/jurisdiction.js
// Per-jurisdiction feature flag helpers for the existing position conversion product line.
// Conversion is disabled by default for all jurisdictions until legal clearance is obtained.

async function isConversionEnabledForCountry(db, countryCode) {
  if (!countryCode) return { enabled: false, lockupDays: 90 };
  const [rows] = await db.execute(
    `SELECT existing_position_conversion_enabled, conversion_lockup_days
     FROM jurisdiction_settings
     WHERE country_code = ?`,
    [countryCode.toUpperCase()]
  );
  if (rows.length === 0) {
    // Unknown jurisdiction — default to disabled (safest default)
    return { enabled: false, lockupDays: 90 };
  }
  return {
    enabled:    rows[0].existing_position_conversion_enabled,
    lockupDays: rows[0].conversion_lockup_days,
  };
}

async function getEnabledJurisdictions(db) {
  const [rows] = await db.execute(
    `SELECT country_code, country_name, conversion_lockup_days
     FROM jurisdiction_settings
     WHERE existing_position_conversion_enabled = TRUE
     ORDER BY country_name`
  );
  return rows;
}

module.exports = { isConversionEnabledForCountry, getEnabledJurisdictions };
