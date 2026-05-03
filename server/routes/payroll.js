const router = require('express').Router();
const {
  getPayroll,
  getAllPayroll,
  processPayroll,
  getPayslipDetail,
  getPayrollDashboardSummary,
  getSalaryStatement,
} = require('../controllers/payrollController');
const { auth, authorize } = require('../middleware/auth');

router.get('/dashboard/summary', auth, authorize('Admin', 'Payroll Officer'), getPayrollDashboardSummary);
router.get('/report/salary-statement/:userId', auth, authorize('Admin', 'Payroll Officer', 'HR Officer'), getSalaryStatement);
router.post('/process', auth, authorize('Admin', 'Payroll Officer'), processPayroll);
router.get('/', auth, authorize('Admin', 'Payroll Officer'), getAllPayroll);
router.get('/:userId/payslip/:month', auth, getPayslipDetail);
router.get('/:userId', auth, getPayroll);

module.exports = router;
