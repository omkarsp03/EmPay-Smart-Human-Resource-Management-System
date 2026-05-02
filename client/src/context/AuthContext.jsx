import { createContext, useContext, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('empay_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const stored = localStorage.getItem('empay_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: t, user: u } = res.data || {};
    if (!t || !u) throw new Error('Invalid response from server.');
    localStorage.setItem('empay_token', t);
    localStorage.setItem('empay_user', JSON.stringify(u));
    flushSync(() => {
      setToken(t);
      setUser(u);
    });
    return u;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    const { token: t, user: u } = res.data || {};
    if (!t || !u) throw new Error('Invalid response from server.');
    localStorage.setItem('empay_token', t);
    localStorage.setItem('empay_user', JSON.stringify(u));
    flushSync(() => {
      setToken(t);
      setUser(u);
    });
    return u;
  };

  const logout = () => {
    localStorage.removeItem('empay_token');
    localStorage.removeItem('empay_user');
    flushSync(() => {
      setToken(null);
      setUser(null);
    });
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.getMe();
      setUser(res.data);
      localStorage.setItem('empay_user', JSON.stringify(res.data));
    } catch {}
  };

  const isAdmin = user?.role === 'Admin';
  const isHR = user?.role === 'HR Officer';
  const isPayroll = user?.role === 'Payroll Officer';
  const isEmployee = user?.role === 'Employee';
  const canManageEmployees = isAdmin || isHR;
  const canManagePayroll = isAdmin || isPayroll;
  const canApproveLeaves = isAdmin || isHR;

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, register, logout, refreshUser,
      isAdmin, isHR, isPayroll, isEmployee,
      canManageEmployees, canManagePayroll, canApproveLeaves,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
