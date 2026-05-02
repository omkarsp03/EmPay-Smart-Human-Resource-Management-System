import axios from 'axios';

// Relative `/api` uses Vite dev/preview proxy → backend. Override when deploying static files
// without a proxy, e.g. VITE_API_BASE=http://192.168.1.10:5050/api
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const API = axios.create({ baseURL: API_BASE });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('empay_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const isAuthPublicPost = (config) => {
  const url = config?.url || '';
  return url.includes('/auth/login') || url.includes('/auth/register');
};

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isAuthPublicPost(err.config)) {
      localStorage.removeItem('empay_token');
      localStorage.removeItem('empay_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  getMe: () => API.get('/auth/me'),
};

// Users
export const userAPI = {
  getAll: (params) => API.get('/users', { params }),
  getById: (id) => API.get(`/users/${id}`),
  create: (data) => API.post('/users', data),
  update: (id, data) => API.put(`/users/${id}`, data),
  delete: (id) => API.delete(`/users/${id}`),
  updateProfile: (data) => API.put('/users/profile/me', data),
  changePassword: (data) => API.post('/users/change-password', data),
  enable2FA: () => API.post('/users/2fa/enable'),
  disable2FA: () => API.post('/users/2fa/disable'),
  verify2FA: (data) => API.post('/users/2fa/verify', data),
  emailCredentials: (id) => API.post(`/users/${id}/email-credentials`),
  updateSalaryStructure: (id, data) => API.put(`/users/${id}/salary-structure`, data),
};

// Attendance
export const attendanceAPI = {
  mark: (data) => API.post('/attendance/mark', data),
  getByUser: (userId, params) => API.get(`/attendance/user/${userId}`, { params }),
  getToday: (params) => API.get('/attendance/today', { params }),
  getWorkforceStatus: () => API.get('/attendance/workforce-status'),
  getShifts: () => API.get('/attendance/shifts'),
  updateShift: (userId, data) => API.put(`/attendance/shift/${userId}`, data),
};

// Leaves
export const leaveAPI = {
  apply: (data) => API.post('/leaves/apply', data),
  getAll: (params) => API.get('/leaves', { params }),
  getBalances: (params) => API.get('/leaves/balances', { params }),
  getAllocations: () => API.get('/leaves/allocations'),
  createAllocation: (data) => API.post('/leaves/allocation', data),
  approve: (id) => API.put(`/leaves/${id}/approve`),
  reject: (id) => API.put(`/leaves/${id}/reject`),
};

// Payroll
export const payrollAPI = {
  getByUser: (userId) => API.get(`/payroll/${userId}`),
  getAll: (params) => API.get('/payroll', { params }),
  getDashboardSummary: () => API.get('/payroll/dashboard/summary'),
  getSalaryStatement: (userId, params) => API.get(`/payroll/report/salary-statement/${userId}`, { params }),
  process: (data) => API.post('/payroll/process', data),
  getPayslipDetail: (userId, month) => API.get(`/payroll/${userId}/payslip/${month}`),
};

// Notifications
export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  markRead: (id) => API.put(`/notifications/${id}/read`),
  markAllRead: () => API.put('/notifications/read-all'),
};

// Analytics
export const analyticsAPI = {
  getDashboard: () => API.get('/analytics/dashboard'),
  getInsights: () => API.get('/analytics/ai-insights'),
  getAnomalies: () => API.get('/analytics/anomalies'),
  getAttritionRisk: () => API.get('/analytics/attrition'),
  getCostBreakdown: () => API.get('/analytics/cost-breakdown'),
  getPayrollForecast: () => API.get('/analytics/payroll-forecast'),
  getAuditLog: (params) => API.get('/analytics/audit-log', { params }),
};

// Chatbot
export const chatbotAPI = {
  ask: (question) => API.post('/chatbot/ask', { question }),
};

export default API;
