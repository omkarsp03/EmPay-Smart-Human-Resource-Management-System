const { db, findById, findByQuery, insertOne, updateOne, deleteOne } = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  normalizeSalaryStructure,
  computeSalaryAmounts,
} = require('../utils/salaryStructure');

function generateEmployeeLoginId(name, companyName, joinDateIso) {
  const raw = (companyName || 'Company').replace(/[^a-zA-Z]/g, '');
  const abbrevCompany = (raw.substring(0, 2).toUpperCase() || 'CO').padEnd(2, 'X');
  const parts = (name || 'User Name').trim().split(/\s+/).filter(Boolean);
  const first = (parts[0] || 'Us').replace(/[^a-zA-Z]/gi, '');
  const last = (parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'Er').replace(/[^a-zA-Z]/gi, '');
  const p1 = (first.substring(0, 2) || 'XX').toUpperCase().padEnd(2, 'X');
  const p2 = (last.substring(0, 2) || 'XX').toUpperCase().padEnd(2, 'X');
  const namePart = `${p1}${p2}`;
  const year = joinDateIso ? new Date(joinDateIso).getFullYear() : new Date().getFullYear();
  const countThisYear = db.users.filter((u) => u.joinDate && new Date(u.joinDate).getFullYear() === year).length + 1;
  const serial = String(countThisYear).padStart(4, '0');
  return `${abbrevCompany}${namePart}${year}${serial}`;
}

// GET /api/users
const getUsers = (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', department, role, status } = req.query;
    let users = [...db.users];
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u =>
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.loginId && String(u.loginId).toLowerCase().includes(s))
      );
    }
    if (department) users = users.filter(u => u.department === department);
    if (role) users = users.filter(u => u.role === role);
    if (status) users = users.filter(u => u.status === status);
    const total = users.length;
    const start = (page - 1) * limit;
    const paginated = users.slice(start, start + parseInt(limit));
    const safe = paginated.map(({ password, twoFactorSecret, salaryStructure, ...rest }) => rest);
    const isPrivileged = ['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role);
    const usersOut = safe.map((u) => {
      if (isPrivileged) return u;
      const { bankDetails: _b, ...pub } = u;
      return { ...pub, bankDetails: undefined };
    });
    res.json({ users: usersOut, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

// GET /api/users/:id
const getUser = (req, res, next) => {
  try {
    const user = findById('users', req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const isSelf = req.user.id === req.params.id;
    const isPrivileged = ['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role);
    const canViewSalaryStructure = ['Admin', 'Payroll Officer'].includes(req.user.role);
    const { password, twoFactorSecret, ...rest } = user;
    if (!isSelf && !isPrivileged) {
      const { bankDetails: _bd, salaryStructure: _s, ...peer } = rest;
      return res.json({ ...peer, bankDetails: { bankName: '', accountNo: '', ifsc: '', pan: '', uan: '', empCode: '' } });
    }
    const out = { ...rest };
    if (!canViewSalaryStructure) delete out.salaryStructure;
    res.json(out);
  } catch (error) {
    next(error);
  }
};

// POST /api/users
const createUser = (req, res, next) => {
  try {
    const {
      name,
      email,
      role = 'Employee',
      department = 'General',
      phone,
      password,
      joinDate,
      managerId,
      designation,
      location,
      modules,
    } = req.body;
    if (db.users.find((u) => u.email === email)) {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    const creator = findById('users', req.user.id);
    const companyName = creator?.companyName || 'EmPay';
    const join = joinDate || new Date().toISOString();
    const loginId = generateEmployeeLoginId(name, companyName, join);
    const tempPassword =
      password ||
      `Emp@${crypto.randomBytes(3).toString('hex')}`;
    const hashedPw = bcrypt.hashSync(tempPassword, 10);
    const user = insertOne('users', {
      name,
      email,
      loginId,
      companyName,
      password: hashedPw,
      role,
      department,
      phone,
      managerId: managerId || null,
      designation: designation || '',
      location: location || '',
      modules: modules && typeof modules === 'object' ? modules : undefined,
      leaveBalances: { 'Paid Time Off': 0, 'Sick Leave': 0, 'Unpaid Leave': 0 },
      status: 'Active',
      joinDate: join,
      shift: 'Morning',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      bankDetails: { bankName: '', accountNo: '', ifsc: '', pan: '', uan: '', empCode: loginId },
    });
    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'User Created',
      details: `Created ${name} (${role}) in ${department} — login ${loginId}`,
      timestamp: new Date().toISOString(),
    });
    insertOne('notifications', {
      userId: user._id,
      message: `Welcome to EmPay! Your login ID is ${loginId}. Please sign in and change your password from Security settings.`,
      type: 'system',
      readStatus: false,
    });
    const { password: pw, twoFactorSecret, ...safe } = user;
    res.status(201).json({ ...safe, temporaryPassword: tempPassword });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id
const updateUser = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.password;
    delete updates._id;
    delete updates.salaryStructure;
    const old = findById('users', id);
    if (!old) return res.status(404).json({ message: 'User not found.' });
    const user = updateOne('users', id, updates);
    insertOne('activityLogs', {
      userId: req.user.id, action: 'User Updated',
      details: `Updated ${old.name}: ${Object.keys(updates).join(', ')}`,
      timestamp: new Date().toISOString(),
    });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (error) { next(error); }
};

// DELETE /api/users/:id
const deleteUser = (req, res, next) => {
  try {
    const { id } = req.params;
    const user = findById('users', id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    deleteOne('users', id);
    insertOne('activityLogs', {
      userId: req.user.id, action: 'User Deleted',
      details: `Deleted ${user.name} (${user.email})`,
      timestamp: new Date().toISOString(),
    });
    res.json({ message: 'User deleted.' });
  } catch (error) { next(error); }
};

// POST /api/users/:id/email-credentials — Admin/HR: reset temp password + notify user (demo: in-app instead of SMTP)
const sendCredentialsEmail = (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Use Change password to update your own login.' });
    }
    const target = findById('users', id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    const tempPassword = `Emp@${crypto.randomBytes(3).toString('hex')}`;
    updateOne('users', id, { password: bcrypt.hashSync(tempPassword, 10) });
    insertOne('notifications', {
      userId: id,
      message: `Your login credentials (as if sent by email): Login ID: ${target.loginId || target.email}. New temporary password: ${tempPassword}. Please sign in and change your password under Settings → Security.`,
      type: 'system',
      readStatus: false,
    });
    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Credentials Sent',
      details: `Delivered credentials to ${target.name} (${target.email})`,
      timestamp: new Date().toISOString(),
    });
    res.json({
      message: 'User notified in-app with login ID and new temporary password (connect SMTP for real email).',
      loginId: target.loginId,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/profile/me — Self-service profile update
const updateProfile = (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      name,
      phone,
      address,
      emergencyContact,
      bloodGroup,
      dateOfBirth,
      skills,
      certifications,
      about,
      jobLove,
      hobbies,
      personalEmail,
      gender,
      maritalStatus,
      nationality,
      bankDetails: bankBody,
    } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (skills !== undefined) updates.skills = skills;
    if (certifications !== undefined) updates.certifications = certifications;
    if (about !== undefined) updates.about = about;
    if (jobLove !== undefined) updates.jobLove = jobLove;
    if (hobbies !== undefined) updates.hobbies = hobbies;
    if (personalEmail !== undefined) updates.personalEmail = personalEmail;
    if (gender !== undefined) updates.gender = gender;
    if (maritalStatus !== undefined) updates.maritalStatus = maritalStatus;
    if (nationality !== undefined) updates.nationality = nationality;
    if (bankBody && typeof bankBody === 'object') {
      const cur = findById('users', userId);
      const prev = cur?.bankDetails || {};
      updates.bankDetails = {
        bankName: bankBody.bankName !== undefined ? bankBody.bankName : prev.bankName,
        accountNo: bankBody.accountNo !== undefined ? bankBody.accountNo : prev.accountNo,
        ifsc: bankBody.ifsc !== undefined ? bankBody.ifsc : prev.ifsc,
        pan: bankBody.pan !== undefined ? bankBody.pan : prev.pan,
        uan: bankBody.uan !== undefined ? bankBody.uan : prev.uan,
        empCode: bankBody.empCode !== undefined ? bankBody.empCode : prev.empCode,
      };
    }

    const user = updateOne('users', userId, updates);
    insertOne('activityLogs', {
      userId, action: 'Profile Updated',
      details: `Self-updated: ${Object.keys(updates).join(', ')}`,
      timestamp: new Date().toISOString(),
    });
    const { password, twoFactorSecret, ...safe } = user;
    res.json(safe);
  } catch (error) { next(error); }
};

// POST /api/users/change-password
const changePassword = (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = findById('users', req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    updateOne('users', req.user.id, { password: bcrypt.hashSync(newPassword, 10) });
    insertOne('activityLogs', {
      userId: req.user.id, action: 'Password Changed',
      details: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    });
    res.json({ message: 'Password changed successfully.' });
  } catch (error) { next(error); }
};

// POST /api/users/2fa/enable
const enable2FA = (req, res, next) => {
  try {
    // Generate a simple TOTP-like secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) secret += chars.charAt(Math.floor(Math.random() * chars.length));
    updateOne('users', req.user.id, { twoFactorEnabled: true, twoFactorSecret: secret });
    insertOne('activityLogs', {
      userId: req.user.id, action: '2FA Enabled',
      details: 'Two-factor authentication enabled',
      timestamp: new Date().toISOString(),
    });
    res.json({
      message: '2FA enabled.',
      secret,
      qrUrl: `otpauth://totp/EmPay:${req.user.email}?secret=${secret}&issuer=EmPay`,
    });
  } catch (error) { next(error); }
};

// POST /api/users/2fa/disable
const disable2FA = (req, res, next) => {
  try {
    updateOne('users', req.user.id, { twoFactorEnabled: false, twoFactorSecret: null });
    insertOne('activityLogs', {
      userId: req.user.id, action: '2FA Disabled',
      details: 'Two-factor authentication disabled',
      timestamp: new Date().toISOString(),
    });
    res.json({ message: '2FA disabled.' });
  } catch (error) { next(error); }
};

// POST /api/users/2fa/verify
const verify2FA = (req, res, next) => {
  try {
    const { code } = req.body;
    const user = findById('users', req.user.id);
    if (!user?.twoFactorEnabled) return res.status(400).json({ message: '2FA not enabled.' });
    // Simple TOTP verification — accept any 6-digit code for demo
    if (code && code.length === 6 && /^\d+$/.test(code)) {
      res.json({ verified: true, message: '2FA verified.' });
    } else {
      res.status(400).json({ verified: false, message: 'Invalid code.' });
    }
  } catch (error) { next(error); }
};

// PUT /api/users/:id/salary-structure — Admin & Payroll Officer only
const updateSalaryStructure = (req, res, next) => {
  try {
    const { id } = req.params;
    const target = findById('users', id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    const merged = normalizeSalaryStructure({ ...target.salaryStructure, ...req.body });
    const computed = computeSalaryAmounts(merged);
    if (!computed.valid) {
      return res.status(400).json({
        message:
          'Salary components exceed monthly wage. Lower basic %, HRA %, standard allowance, or other earnings.',
      });
    }
    if (merged.monthWage <= 0) {
      return res.status(400).json({ message: 'Monthly wage must be greater than zero.' });
    }
    const user = updateOne('users', id, { salaryStructure: merged });
    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Salary Structure Updated',
      details: `Updated salary structure for ${user.name} (monthly wage ${merged.monthWage})`,
      timestamp: new Date().toISOString(),
    });
    const { password, twoFactorSecret, ...safe } = user;
    res.json({ user: safe, computed });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateProfile,
  changePassword,
  enable2FA,
  disable2FA,
  verify2FA,
  sendCredentialsEmail,
  updateSalaryStructure,
};
