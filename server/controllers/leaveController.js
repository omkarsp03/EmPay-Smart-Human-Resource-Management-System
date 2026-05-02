const { db, findById, findByQuery, insertOne, updateOne } = require('../config/db');

function leaveDayCount(startDate, endDate) {
  const a = new Date(startDate);
  const b = new Date(endDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// POST /api/leaves/apply
const applyLeave = (req, res, next) => {
  try {
    const { type, startDate, endDate, reason, attachment } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: 'Start date must be before end date.' });
    }

    const leave = insertOne('leaves', {
      userId: req.user.id,
      type,
      startDate,
      endDate,
      reason,
      attachment: attachment || '',
      status: 'Pending',
      approvedBy: null,
    });

    // Notify HR and Admin
    const hrAdmins = db.users.filter(u => u.role === 'Admin' || u.role === 'HR Officer');
    const user = findById('users', req.user.id);
    hrAdmins.forEach(admin => {
      insertOne('notifications', {
        userId: admin._id,
        message: `${user?.name || 'An employee'} has applied for ${type} leave (${startDate} to ${endDate})`,
        type: 'leave',
        readStatus: false,
      });
    });

    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Applied',
      details: `Applied for ${type} leave: ${startDate} to ${endDate}`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ message: 'Leave applied successfully.', leave });
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
      leaves = leaves.filter(l => l.userId === req.user.id);
    } else if (userId) {
      leaves = leaves.filter(l => l.userId === userId);
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

    const employee = findById('users', leave.userId);
    if (employee && leave.type !== 'Unpaid Leave') {
      const days = leaveDayCount(leave.startDate, leave.endDate);
      const balances = { ...(employee.leaveBalances || {}) };
      const key = leave.type;
      const cur = parseFloat(balances[key]) || 0;
      balances[key] = Math.max(0, +(cur - days).toFixed(2));
      updateOne('users', leave.userId, { leaveBalances: balances });
    }

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

    insertOne('notifications', {
      userId: leave.userId,
      message: `Your ${leave.type} leave (${leave.startDate} to ${leave.endDate}) has been rejected.`,
      type: 'error',
      readStatus: false,
    });

    insertOne('activityLogs', {
      userId: req.user.id,
      action: 'Leave Rejected',
      details: `Rejected ${leave.type} leave for user ${leave.userId}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Leave rejected.', leave: updated });
  } catch (error) {
    next(error);
  }
};

// POST /api/leaves/allocation — HR/Admin accrual buckets
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
      rows = rows.filter((a) => a.userId === req.user.id);
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

// GET /api/leaves/balances — current user (or any user for HR)
const getLeaveBalances = (req, res, next) => {
  try {
    const targetId = req.query.userId;
    if (targetId && !['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const uid = targetId && ['Admin', 'HR Officer', 'Payroll Officer'].includes(req.user.role) ? targetId : req.user.id;
    const user = findById('users', uid);
    const defaults = { 'Paid Time Off': 0, 'Sick Leave': 0, 'Unpaid Leave': 0 };
    res.json({ ...defaults, ...(user?.leaveBalances || {}) });
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
};
