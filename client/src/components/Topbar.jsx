import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import { notificationAPI } from '../api';
import { Search, Bell, Sun, Moon, CheckCheck, LogOut, User, ChevronDown } from 'lucide-react';
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
  const [clock, setClock] = useState(() => new Date());
  const menuRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
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
