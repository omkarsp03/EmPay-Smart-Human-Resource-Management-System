const express = require('express');
const {
  applyLeave,
  getLeaves,
  approveLeave,
  rejectLeave,
  createAllocation,
  getAllocations,
  getLeaveBalances,
} = require('../controllers/leaveController');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/apply', auth, applyLeave);
router.get('/balances', auth, getLeaveBalances);
router.get('/allocations', auth, getAllocations);
router.post('/allocation', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), createAllocation);
router.get('/', auth, getLeaves);
router.put('/:id/approve', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), approveLeave);
router.put('/:id/reject', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), rejectLeave);

module.exports = router;
