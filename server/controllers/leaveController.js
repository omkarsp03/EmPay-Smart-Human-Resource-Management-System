const { db, findById, findByQuery, insertOne, updateOne } = require('../config/db');

// ============================================================
// CONSTANTS — Predefined annual leave limits per type
// ============================================================
const ANNUAL_LEAVE_LIMITS = {
  'Paid Time Off':  15,  // 15 days per year
  'Sick Leave':     12,  // 12 days per year
  'Unpaid Leave':   30,  // Unpaid has a generous cap (or unlimited — enforce separately if needed)
};

// Helper: count calendar days between two date strings (inclusive)
function leaveDayCount(startDate, endDate) {
  const a = new Date(startDate);
  const b = new Date(endDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Helper: get an employee's current balance for a leave type.
// If the user has never had a balance set, seed it from the annual limit.
function getBalance(user, type) {
  const balances = user.leaveBalances || {};
  if (balances[type] !== undefined) return parseFloat(balances[type]);
  // First time — use the annual limit as the starting balance
  return ANNUAL_LEAVE_LIMITS[type] ?? 0;
}

// Helper: ensure every user has balances initialized (called internally)
function ensureBalancesInitialized(userId) {
  const user = findById('users', userId);
  if (!user) return;
  const balances = { ...(user.leaveBalances || {}) };
  let changed = false;
  Object.entries(ANNUAL_LEAVE_LIMITS).forEach(([type, limit]) => {
    if (balances[type] === undefined) {
      balances[type] = limit;
      changed = true;
    }
  });
  if (changed) updateOne('users', userId, { leaveBalances: balances });
}

// POST /api/leaves/apply
const applyLeave = (req, res, next) => {
  try {
    const { type, startDate, endDate, reason, attachment } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const reqStart = new Date(startDate);
    const reqEnd = new Date(endDate);

    if (reqStart > reqEnd) {
      return res.status(400).json({ message: 'Start date must be before end date.' });
    }

    const daysRequested = leaveDayCount(startDate, endDate);
    const user = findById('users', req.user.id);

    // === BALANCE CHECK (for paid leave types) ===
    if (type !== 'Unpaid Leave') {
      ensureBalancesInitialized(req.user.id);
      const freshUser = findById('users', req.user.id); // re-fetch after possible init
      const currentBalance = getBalance(freshUser, type);
      const annualLimit = ANNUAL_LEAVE_LIMITS[type];

      if (annualLimit !== undefined && daysRequested > currentBalance) {
        return res.status(400).json({
          message: `Insufficient ${type} balance. You have ${currentBalance} day(s) remaining but requested ${daysRequested} day(s). Annual limit is ${annualLimit} days.`,
        });
      }
    }

    // === OVERLAP CHECK ===
    // Reject if any existing Pending or Approved leave overlaps with these dates
    const overlapping = db.leaves.filter((l) => {
      if (String(l.userId) !== String(req.user.id)) return false;
      if (l.status === 'Rejected') return false;
      const lStart = new Date(l.startDate);
      const lEnd = new Date(l.endDate);
      return lStart <= reqEnd && lEnd >= reqStart;
    });

    if (overlapping.length > 0) {
      const conflict = overlapping[0];
      return res.status(400).json({
        message: `You already have a ${conflict.type} leave (${conflict.status}) from ${conflict.startDate} to ${conflict.endDate} that overlaps with these dates.`,
      });
    }
    // === END OVERLAP CHECK ===

    // === DEDUCT BALANCE IMMEDIATELY ON APPLICATION ===
    // Days are reserved the moment the application is submitted,
    // so the employee can see their updated balance right away.
    if (type !== 'Unpaid Leave') {
      const freshUser = findById('users', req.user.id);
      const balances = { ...(freshUser.leaveBalances || {}) };
      const currentBalance = getBalance(freshUser, type);
      balances[type] = Math.max(0, +(currentBalance - daysRequested).toFixed(2));
      updateOne('users', req.user.id, { leaveBalances: balances });
    }

    const leave = insertOne('leaves', {
      userId: req.user.id,
      type,
      startDate,
      endDate,
      daysRequested,   // store for easy reference & refund
      reason,
      attachment: attachment || '',
      status: 'Pending',
      approvedBy: null,
    });

    // Notify HR and Admin
    const hrAdmins = db.users.filter(u => u.role === 'Admin' || u.role === 'HR Officer');
    hrAdmins.forEach(admin => {
      insertOne('notifications', {
        userId: admin._id,
        message: `${user?.name || 'An employee'} applied for ${type} leave (${startDate} to ${endDate}) — ${daysRequested} day(s)`,
        type: 'leave',
        readStatus: false,
      });
    });

    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Applied',
      details: `Applied for ${type} leave: ${startDate} to ${endDate} (${daysRequested} days)`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ message: 'Leave applied successfully. Balance has been updated.', leave });
  } catch (error) {
    next(error);
  }
};

// GET /api/leaves
const getLeaves = (req, res, next) => {
  try {
    const { status, type, userId } = req.query;
    let leaves = [...db.leaves];

    // Employees can only see their own
    if (req.user.role === 'Employee') {
      leaves = leaves.filter(l => String(l.userId) === String(req.user.id));
    } else if (userId) {
      leaves = leaves.filter(l => String(l.userId) === String(userId));
    }

    if (status) leaves = leaves.filter(l => l.status === status);
    if (type) leaves = leaves.filter(l => l.type === type);

    // Enrich with user info
    const enriched = leaves.map(leave => {
      const user = findById('users', leave.userId);
      return {
        ...leave,
        userName: user ? user.name : 'Unknown',
        userDepartment: user ? user.department : 'Unknown',
      };
    });

    enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(enriched);
  } catch (error) {
    next(error);
  }
};

// PUT /api/leaves/:id/approve
// Balance was already deducted when the employee applied — nothing more to do here.
const approveLeave = (req, res, next) => {
  try {
    const leave = findById('leaves', req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Leave is already processed.' });
    }

    const updated = updateOne('leaves', req.params.id, {
      status: 'Approved',
      approvedBy: req.user.id,
    });

    // NOTE: Balance was already deducted when the employee submitted the request.
    // No further balance change is needed here.

    insertOne('notifications', {
      userId: leave.userId,
      message: `Your ${leave.type} leave (${leave.startDate} to ${leave.endDate}) has been approved.`,
      type: 'success',
      readStatus: false,
    });

    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Approved',
      details: `Approved ${leave.type} leave for user ${leave.userId}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Leave approved.', leave: updated });
  } catch (error) {
    next(error);
  }
};

// PUT /api/leaves/:id/reject
// REFUND the deducted days back to the employee's balance.
const rejectLeave = (req, res, next) => {
  try {
    const leave = findById('leaves', req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Leave is already processed.' });
    }

    const updated = updateOne('leaves', req.params.id, {
      status: 'Rejected',
      approvedBy: req.user.id,
    });

    // === REFUND BALANCE ON REJECTION ===
    // Since we deducted days when the leave was applied, we must add them back now.
    if (leave.type !== 'Unpaid Leave') {
      const employee = findById('users', leave.userId);
      if (employee) {
        const daysToRefund = leave.daysRequested || leaveDayCount(leave.startDate, leave.endDate);
        const balances = { ...(employee.leaveBalances || {}) };
        const annualLimit = ANNUAL_LEAVE_LIMITS[leave.type] ?? Infinity;
        const currentBalance = getBalance(employee, leave.type);
        // Cap the refunded balance at the annual limit (can't exceed it)
        balances[leave.type] = Math.min(annualLimit, +(currentBalance + daysToRefund).toFixed(2));
        updateOne('users', leave.userId, { leaveBalances: balances });
      }
    }
    // === END REFUND ===

    insertOne('notifications', {
      userId: leave.userId,
      message: `Your ${leave.type} leave (${leave.startDate} to ${leave.endDate}) has been rejected. The ${leave.daysRequested || leaveDayCount(leave.startDate, leave.endDate)} day(s) have been returned to your balance.`,
      type: 'error',
      readStatus: false,
    });

    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Rejected',
      details: `Rejected ${leave.type} leave for user ${leave.userId}. Days refunded.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Leave rejected. Balance has been refunded.', leave: updated });
  } catch (error) {
    next(error);
  }
};

// POST /api/leaves/allocation — HR/Admin manually top-up buckets
const createAllocation = (req, res, next) => {
  try {
    if (!['Admin', 'HR Officer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only HR or Admin can manage allocations.' });
    }
    const { userId, type, validFrom, validTo, days, note, noEndLimit } = req.body;
    if (!userId || !type || !validFrom || days === undefined || days === null) {
      return res.status(400).json({ message: 'Employee, type, valid from, and allocation days are required.' });
    }
    const alloc = insertOne('leaveAllocations', {
      userId,
      type,
      validFrom,
      validTo: noEndLimit ? null : validTo || null,
      days: parseFloat(days) || 0,
      note: note || '',
      noEndLimit: !!noEndLimit,
    });
    const user = findById('users', userId);
    if (user) {
      const balances = { ...(user.leaveBalances || {}) };
      balances[type] = (parseFloat(balances[type]) || 0) + (parseFloat(days) || 0);
      updateOne('users', userId, { leaveBalances: balances });
    }
    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Allocation',
      details: `Allocated ${days} days of ${type} for user ${userId}`,
      timestamp: new Date().toISOString(),
    });
    res.status(201).json(alloc);
  } catch (error) {
    next(error);
  }
};

// GET /api/leaves/allocations
const getAllocations = (req, res, next) => {
  try {
    let rows = [...db.leaveAllocations];
    if (req.user.role === 'Employee') {
      rows = rows.filter((a) => String(a.userId) === String(req.user.id));
    }
    const enriched = rows.map((a) => {
      const u = findById('users', a.userId);
      return { ...a, userName: u ? u.name : 'Unknown' };
    });
    enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(enriched);
  } catch (error) {
    next(error);
  }
};

// GET /api/leaves/balances — returns current balance AND annual limits for the UI
const getLeaveBalances = (req, res, next) => {
  try {
    const targetId = req.query.userId;
    if (targetId && !['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const uid = targetId && ['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role)
      ? targetId
      : req.user.id;

    // Make sure this user has balances initialized before returning them
    ensureBalancesInitialized(uid);
    const user = findById('users', uid);

    // Build the response with both the current balance and the annual limit
    const balanceWithLimits = {};
    Object.entries(ANNUAL_LEAVE_LIMITS).forEach(([type, limit]) => {
      balanceWithLimits[type] = {
        remaining: getBalance(user, type),
        limit,
      };
    });

    res.json(balanceWithLimits);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyLeave,
  getLeaves,
  approveLeave,
  rejectLeave,
  createAllocation,
  getAllocations,
  getLeaveBalances,
  ANNUAL_LEAVE_LIMITS,
};


