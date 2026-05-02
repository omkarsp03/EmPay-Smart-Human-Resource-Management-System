const router = require('express').Router();
const {
  markAttendance,
  getUserAttendance,
  getTodayAttendance,
  getShifts,
  updateShift,
  getWorkforceStatus,
} = require('../controllers/attendanceController');
const { auth, authorize } = require('../middleware/auth');

router.post('/mark', auth, markAttendance);
router.get('/workforce-status', auth, getWorkforceStatus);
router.get('/user/:userId', auth, getUserAttendance);
router.get('/today', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), getTodayAttendance);
router.get('/shifts', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), getShifts);
router.put('/shift/:userId', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), updateShift);

module.exports = router;
