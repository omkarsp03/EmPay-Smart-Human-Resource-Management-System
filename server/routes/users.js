const router = require('express').Router();
const {
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
} = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('Admin', 'HR Officer', 'Employee', 'Payroll Officer'), getUsers);
router.post('/', auth, authorize('Admin', 'HR Officer'), createUser);
router.put('/profile/me', auth, updateProfile);
router.post('/change-password', auth, changePassword);
router.post('/:id/email-credentials', auth, authorize('Admin', 'HR Officer'), sendCredentialsEmail);
router.put('/:id/salary-structure', auth, authorize('Admin', 'Payroll Officer'), updateSalaryStructure);
router.get('/:id', auth, getUser);
router.post('/2fa/enable', auth, enable2FA);
router.post('/2fa/disable', auth, disable2FA);
router.post('/2fa/verify', auth, verify2FA);
router.put('/:id', auth, authorize('Admin', 'HR Officer'), updateUser);
router.delete('/:id', auth, authorize('Admin'), deleteUser);

module.exports = router;
