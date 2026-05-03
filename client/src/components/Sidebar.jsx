import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserSearch, UserCircle, CalendarCheck, CalendarOff, Wallet,
  BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Zap, Shield
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: Users, label: 'Employees', roles: ['Admin', 'HR Officer', 'Employee', 'Payroll Officer'] },
  { path: '/employees', icon: UserSearch, label: 'Team Directory', roles: ['Admin', 'HR Officer', 'Payroll Officer'] },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance', roles: ['Admin', 'HR Officer', 'Employee', 'Payroll Officer'] },
  { path: '/time-off', icon: CalendarOff, label: 'Time Off', roles: ['Admin', 'HR Officer', 'Employee', 'Payroll Officer'] },
  { path: '/payroll', icon: Wallet, label: 'Payroll', roles: ['Admin', 'Payroll Officer', 'Employee'] },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['Admin', 'Payroll Officer'] },
  { path: '/audit-log', icon: Shield, label: 'Audit Log', roles: ['Admin'] },
  { path: '/settings', icon: Settings, label: 'Settings', roles: ['Admin', 'HR Officer', 'Employee'] },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role));

  useEffect(() => { setMobileOpen(false); }, [location]);

  return (
    <>
      <div className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon"><Zap size={20} /></div>
            {!collapsed && <span className="logo-text">EmPay</span>}
          </div>
          <button className="sidebar-toggle btn-ghost btn-icon btn-sm" onClick={onToggle}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sidebar-user">
              <div className="avatar avatar-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name}</span>
                <span className="sidebar-user-role">{user?.role}</span>
              </div>
            </div>
          )}
          <button className="sidebar-link logout-btn" onClick={logout} title="Logout">
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
        <Users size={20} />
      </button>
    </>
  );
}
