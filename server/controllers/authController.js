const bcrypt = require('bcryptjs');
const { db, findByQuery, insertOne } = require('../config/db');
const generateToken = require('../utils/generateToken');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department, phone, companyName, companyLogo } = req.body;

    if (db.users.length > 0) {
      return res.status(403).json({
        message: 'Registration is restricted. Only an HR officer or administrator can create new accounts from the team directory.',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = findByQuery('users', { email });
    if (existing.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate Login ID: [Company Initials] + [Employee Initials] + [Year] + [Serial Number]
    const getInitials = (str) => (str || '').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3) || 'XXX';
    const compInitials = getInitials(companyName || 'EmPay');
    const empInitials = getInitials(name);
    const year = new Date().getFullYear();
    const serial = String(db.users.length + 1).padStart(4, '0');
    const loginId = `${compInitials}${empInitials}${year}${serial}`;

    const user = insertOne('users', {
      name,
      email,
      loginId,
      companyName: companyName || 'EmPay',
      companyLogo: companyLogo || '',
      password: hashedPassword,
      role: role || 'Employee',
      department: department || 'General',
      phone: phone || '',
      avatar: '',
      status: 'Active',
      joinDate: new Date().toISOString(),
      skills: [],
      certifications: [],
      interests: [],
      bankDetails: { bankName: '', accountNo: '', ifsc: '', pan: '', uan: '' },
    });

    // Log activity
    insertOne('activityLogs', {
      userId: user._id,
      action: 'User Registered',
      details: `${user.name} registered as ${user.role}`,
      timestamp: new Date().toISOString(),
    });

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    if (!['Admin', 'Payroll Officer'].includes(userWithoutPassword.role)) {
      delete userWithoutPassword.salaryStructure;
    }

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    let { email, password } = req.body; // 'email' can be email or loginId
    email = typeof email === 'string' ? email.trim() : email;

    if (!email || !password) {
      return res.status(400).json({ message: 'Login ID/Email and password are required.' });
    }

    const emailLower = email.toLowerCase();
    const loginIdNorm = email.toUpperCase();
    const users = db.users.filter(
      (u) =>
        u.email?.toLowerCase() === emailLower ||
        (u.loginId && u.loginId.toUpperCase() === loginIdNorm)
    );
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Contact HR.' });
    }

    // Log activity
    insertOne('activityLogs', {
      userId: user._id,
      action: 'User Login',
      details: `${user.name} logged in`,
      timestamp: new Date().toISOString(),
    });

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    if (!['Admin', 'Payroll Officer'].includes(userWithoutPassword.role)) {
      delete userWithoutPassword.salaryStructure;
    }

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const { findById } = require('../config/db');
    const user = findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const { password: _, ...userWithoutPassword } = user;
    if (!['Admin', 'Payroll Officer'].includes(userWithoutPassword.role)) {
      delete userWithoutPassword.salaryStructure;
    }
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
