const jwt = require('jsonwebtoken');
const { findById } = require('../config/db');

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'empay_super_secret_key_2024_hrms_production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    // Fetch real-time user data from the database to ensure roles haven't changed since login
    const realUser = findById('users', req.user.id);
    if (!realUser) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    // Check the real-time role
    if (!roles.includes(realUser.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    
    // Update req.user to have the fresh role for downstream controllers just in case
    req.user.role = realUser.role;
    next();
  };
};

module.exports = { auth, authorize };
