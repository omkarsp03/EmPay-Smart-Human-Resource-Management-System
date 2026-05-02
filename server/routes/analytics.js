const router = require('express').Router();
const { getDashboardStats, getAIInsights, getAnomalies, getAttritionRisk, getCostBreakdown, getPayrollForecast, getAuditLog } = require('../controllers/analyticsController');
const { auth, authorize } = require('../middleware/auth');

router.get('/dashboard', auth, getDashboardStats);
router.get('/ai-insights', auth, authorize('Admin', 'HR Officer'), getAIInsights);
router.get('/anomalies', auth, authorize('Admin', 'HR Officer'), getAnomalies);
router.get('/attrition', auth, authorize('Admin', 'HR Officer'), getAttritionRisk);
router.get('/cost-breakdown', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), getCostBreakdown);
router.get('/payroll-forecast', auth, authorize('Admin', 'HR Officer', 'Payroll Officer'), getPayrollForecast);
router.get('/audit-log', auth, authorize('Admin'), getAuditLog);

module.exports = router;
