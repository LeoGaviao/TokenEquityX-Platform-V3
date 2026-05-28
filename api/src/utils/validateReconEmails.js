const { getSetting } = require('./platformSettings');

const BLOCKED_DOMAINS = ['example.com', 'test.com', 'localhost', 'domain.com', 'placeholder.com'];

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email.trim())) return false;
  const domain = email.trim().split('@')[1]?.toLowerCase();
  if (BLOCKED_DOMAINS.includes(domain)) return false;
  return true;
}

// Reads platform_settings first (runtime config), falls back to env vars.
// This allows admins to update recipients without redeployment.
async function getReconEmailStatus() {
  const primary   = ((await getSetting('reconciliation_email_primary'))   || process.env.RECONCILIATION_EMAIL_PRIMARY   || '').trim();
  const secondary = ((await getSetting('reconciliation_email_secondary')) || process.env.RECONCILIATION_EMAIL_SECONDARY || '').trim();
  const tertiary  = ((await getSetting('reconciliation_email_tertiary'))  || process.env.RECONCILIATION_EMAIL_TERTIARY  || '').trim();

  const primaryValid   = isValidEmail(primary);
  const secondaryValid = isValidEmail(secondary);
  const tertiaryValid  = isValidEmail(tertiary);

  const recipients = [primary, secondary, tertiary].filter(e => isValidEmail(e));

  return {
    canOperate: primaryValid && secondaryValid,
    primary:    { email: primary,   valid: primaryValid,   required: true },
    secondary:  { email: secondary, valid: secondaryValid, required: true },
    tertiary:   { email: tertiary,  valid: tertiaryValid,  required: false },
    recipients,
    errors: [
      !primaryValid   && 'Primary notification email is missing or invalid',
      !secondaryValid && 'Secondary notification email is missing or invalid',
      tertiary && !tertiaryValid && 'Tertiary notification email is invalid (will be ignored)',
    ].filter(Boolean),
  };
}

module.exports = { isValidEmail, getReconEmailStatus };
