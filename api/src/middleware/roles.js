const requireRole = (...roles) => (req, res, next) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.dbUser.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`
    });
  }
  next();
};

const requireKYC = (req, res, next) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // These roles are onboarded off-platform — KYC not required
  const kycExemptRoles = ['ADMIN', 'AUDITOR', 'PARTNER', 'DFI', 'COMPLIANCE_OFFICER'];
  if (kycExemptRoles.includes(req.dbUser.role)) {
    return next();
  }
  if (req.dbUser.kyc_status !== 'APPROVED') {
    return res.status(403).json({
      error: 'KYC verification required',
      kycStatus: req.dbUser.kyc_status
    });
  }
  next();
};

module.exports = { requireRole, requireKYC };