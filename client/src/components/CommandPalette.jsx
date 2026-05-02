import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, UserCircle, CalendarCheck, CalendarOff, Wallet, BarChart3, Settings, ArrowRight } from 'lucide-react';
import './CommandPalette.css';

const pages = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'My Profile', path: '/profile', icon: UserCircle },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
  { name: 'Time Off', path: '/time-off', icon: CalendarOff },
  { name: 'Payroll', path: '/payroll', icon: Wallet },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const filtered = pages.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].path);
      onClose();
    }
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay animate-fade-in" onClick={onClose}>
      <div className="cmd-palette animate-slide-down" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrapper">
          <Search size={18} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search pages, actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="cmd-results">
          {filtered.length === 0 ? (
            <div className="cmd-empty">No results found</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.path}
                className={`cmd-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => { navigate(item.path); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
                <ArrowRight size={14} className="cmd-item-arrow" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
