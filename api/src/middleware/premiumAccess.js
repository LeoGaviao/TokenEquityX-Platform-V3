// api/src/middleware/premiumAccess.js
// Helper — does not attach to req/res; call it from route handlers directly.

async function checkPremiumAccess(userId, db) {
  const [[user]] = await db.execute(
    `SELECT investor_tier, premium_trial_start_date,
            premium_trial_end_date, premium_subscription_status
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return { hasPremium: false, reason: 'USER_NOT_FOUND' };

  const [settingRows] = await db.execute(
    `SELECT value FROM platform_settings WHERE key = 'premium_trial_end_date'`
  );

  const now           = new Date();
  const globalTrialEnd = settingRows.length > 0 ? new Date(settingRows[0].value) : new Date(0);
  const userTrialEnd   = user.premium_trial_end_date ? new Date(user.premium_trial_end_date) : new Date(0);

  // Rule 1: Global sandbox trial still active
  if (now < globalTrialEnd) {
    return { hasPremium: true, reason: 'GLOBAL_TRIAL', expiresAt: globalTrialEnd };
  }

  // Rule 2: User individual trial still active
  if (now < userTrialEnd) {
    return {
      hasPremium:     true,
      reason:         'INDIVIDUAL_TRIAL',
      expiresAt:      userTrialEnd,
      daysRemaining:  Math.ceil((userTrialEnd - now) / 86400000),
    };
  }

  // Rule 3: Active paid subscription
  if (user.premium_subscription_status === 'ACTIVE') {
    return { hasPremium: true, reason: 'PAID_SUBSCRIPTION' };
  }

  // Rule 4: No active premium
  return { hasPremium: false, reason: 'EXPIRED', tier: user.investor_tier };
}

module.exports = { checkPremiumAccess };
