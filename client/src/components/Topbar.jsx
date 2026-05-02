import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import { notificationAPI, attendanceAPI } from '../api';
import { Search, Bell, Sun, Moon, CheckCheck, LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import './Topbar.css';

export default function Topbar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [attOpen, setAttOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const menuRef = useRef(null);
  const attRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshAttendance = useCallback(async () => {
    if (!user?._id) return;
    try {
      const month = new Date().toISOString().substring(0, 7);
      const res = await attendanceAPI.getByUser(user._id, { month });
      const today = new Date().toISOString().split('T')[0];
      const rec = (res.data.records || []).find((r) => String(r.date).startsWith(today));
      setCheckedIn(!!rec?.checkIn && !rec?.checkOut);
    } catch {
      setCheckedIn(false);
    }
  }, [user?._id]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshAttendance();
  }, [refreshAttendance]);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (attRef.current && !attRef.current.contains(e.target)) setAttOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
    } catch {}
  };

  const getNotifIcon = (type) => {
    const map = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', leave: '📋', payroll: '💰' };
    return map[type] || '📌';
  };

  const handleCheckIn = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await attendanceAPI.mark({
            type: 'Check-In',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          toast.success(res.data?.message || 'Checked in');
          setCheckedIn(true);
          setAttOpen(false);
          refreshAttendance();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Check-in failed');
        }
      },
      () => toast.error('Location access is required for check-in.')
    );
  };

  const handleCheckOut = async () => {
    try {
      const res = await attendanceAPI.mark({ type: 'Check-Out' });
      toast.success(res.data?.message || 'Checked out');
      setCheckedIn(false);
      setAttOpen(false);
      refreshAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-search" onClick={onOpenCommandPalette}>
          <Search size={16} />
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="topbar-right">
        <time
          dateTime={clock.toISOString()}
          className="topbar-clock text-sm text-secondary"
          style={{ fontVariantNumeric: 'tabular-nums', marginRight: 4, whiteSpace: 'nowrap' }}
        >
          {clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </time>
        <button type="button" className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="notif-container" ref={notifRef}>
          <button type="button" className="btn btn-ghost btn-icon notif-btn" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifs && (
            <div className="notif-dropdown animate-slide-down">
              <div className="notif-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div key={n._id} className={`notif-item ${!n.readStatus ? 'unread' : ''}`}>
                      <span className="notif-icon">{getNotifIcon(n.type)}</span>
                      <div className="notif-content">
                        <p>{n.message}</p>
                        <span className="notif-time">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="notif-container" ref={attRef}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            title="Attendance"
            onClick={() => setAttOpen(!attOpen)}
            style={{ position: 'relative' }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: checkedIn ? 'var(--success)' : 'var(--error)',
                display: 'block',
                boxShadow: '0 0 0 2px var(--bg-secondary)',
              }}
            />
          </button>
          {attOpen && (
            <div className="notif-dropdown animate-slide-down" style={{ right: 0, left: 'auto', minWidth: 220, padding: 'var(--space-3)' }}>
              <p className="text-xs text-secondary" style={{ margin: '0 0 var(--space-2)' }}>
                {checkedIn ? 'You are checked in today.' : 'You are not checked in.'}
              </p>
              {checkedIn ? (
                <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={handleCheckOut}>
                  <LogOut size={16} /> Check Out
                </button>
              ) : (
                <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleCheckIn}>
                  <LogIn size={16} /> Check In
                </button>
              )}
            </div>
          )}
        </div>

        <div className="notif-container" ref={menuRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ cursor: 'pointer', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div className="avatar avatar-sm">{user?.name?.charAt(0)?.toUpperCase()}</div>
            <div className="topbar-user-info" style={{ textAlign: 'left' }}>
              <span className="topbar-user-name">{user?.name}</span>
              <span className="topbar-user-role">{user?.role}</span>
            </div>
            <ChevronDown size={16} className="text-tertiary" />
          </button>
          {menuOpen && (
            <div className="notif-dropdown animate-slide-down" style={{ right: 0, left: 'auto', minWidth: 200, padding: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={16} /> My Profile
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)' }}
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
