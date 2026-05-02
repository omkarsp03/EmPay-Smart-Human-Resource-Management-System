const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET || 'empay_super_secret_key_2024_hrms_production',
    { expiresIn: '24h' }
  );
};

module.exports = generateToken;
