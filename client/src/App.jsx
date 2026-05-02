import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import TimeOff from './pages/TimeOff';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

function RoleRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return allowedRoles.includes(user?.role) ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<RoleRoute allowedRoles={['Admin', 'HR Officer', 'Employee', 'Payroll Officer']}><Employees /></RoleRoute>} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/time-off" element={<TimeOff />} />
        <Route path="/payroll" element={<RoleRoute allowedRoles={['Admin', 'Payroll Officer', 'Employee']}><Payroll /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute allowedRoles={['Admin', 'Payroll Officer']}><Reports /></RoleRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Settings />} />
        <Route path="/audit-log" element={<RoleRoute allowedRoles={['Admin']}><AuditLog /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
