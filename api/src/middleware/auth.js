const jwt    = require('jsonwebtoken');
const db     = require('../db/pool');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );

    // Fetch fresh user data on every request
    const [users] = await db.execute(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user   = decoded;
    req.dbUser = users[0];
    next();
  } catch (err) {
    logger.warn('Auth failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next();
  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );
  } catch {}
  next();
};

module.exports = { authenticate, optionalAuth };