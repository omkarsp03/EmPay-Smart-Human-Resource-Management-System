import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, attendanceAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import EmployeeProfileModal from '../components/EmployeeProfileModal';
import { Search, LogIn, LogOut, CheckCircle, Plane, AlertCircle } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user, canManageEmployees } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [workforceMap, setWorkforceMap] = useState({});
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const [usersRes, todayAtt, wfRes] = await Promise.all([
        userAPI.getAll({ page: 1, limit: 50 }),
        attendanceAPI.getByUser(user._id, { month: new Date().toISOString().substring(0, 7) }),
        attendanceAPI.getWorkforceStatus().catch(() => ({ data: { statusByUser: {} } })),
      ]);
      setEmployees(usersRes.data.users);
      setWorkforceMap(wfRes.data?.statusByUser || {});
      const todayDate = new Date().toISOString().split('T')[0];
      const todayRecord = todayAtt.data.records.find(r => r.date.startsWith(todayDate));
      if (todayRecord) {
        // Active session = checked in without checkout
        const isActive = !!todayRecord.checkIn && !todayRecord.checkOut;
        setIsCheckedIn(isActive);
        setCheckInTime(todayRecord.checkIn);
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
      }
    } catch {}
    setLoading(false);
  }, [user?._id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const doMark = async (payload = {}) => {
    try {
      const res = await attendanceAPI.mark(payload);
      toast.success(res.data.message);
      if (res.data.geofence) {
        toast.info(res.data.geofence.withinRange ? '📍 Within office range' : '🏠 Outside office — marked as WFH');
      }
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleCheckIn = async () => {
    // Try to get location, but don't block check-in if it fails
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          doMark({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        () => {
          // Location denied/failed — proceed without location
          toast.info('Location unavailable — checking in without geo.');
          doMark({});
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      doMark({});
    }
  };

  const handleCheckOut = async () => {
    doMark({});
  };

  const getStatusIcon = (status) => {
    if (status === 'On Leave') return <div className="status-indicator status-leave"><Plane size={10} /></div>;
    if (status === 'Absent') return <div className="status-indicator status-absent"><AlertCircle size={10} /></div>;
    return <div className="status-indicator status-present"><CheckCircle size={10} /></div>;
  };

  const cardStatus = (emp) => workforceMap[emp._id] || (emp.status === 'Inactive' ? 'Absent' : 'Present');

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="dashboard animate-fade-in" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
      
      {/* Main Content: Employee Grid */}
      <div style={{ flex: 1 }}>
        <div className="page-header" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <h1>Employees</h1>
              <p className="text-secondary">Welcome back, {user?.name} 👋</p>
            </div>
            {canManageEmployees && (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/employees')}>
                NEW
              </button>
            )}
          </div>
          <div className="search-wrapper">
            <Search size={16} />
            <input className="input" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, maxWidth: 300 }} />
          </div>
        </div>

        <div className="employee-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          {loading ? (
            Array(8).fill(0).map((_, i) => <div key={i} className="card skeleton" style={{ height: 160 }} />)
          ) : (
            filteredEmployees.map(emp => (
              <div 
                key={emp._id} 
                className="employee-card card" 
                onClick={() => { setSelectedUserId(emp._id); setProfileModalOpen(true); }}
                style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {/* Status Indicator */}
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  {getStatusIcon(emp.status === 'Inactive' ? 'Absent' : cardStatus(emp))}
                </div>
                
                <div className="avatar avatar-lg" style={{ marginBottom: 'var(--space-3)', width: 64, height: 64, fontSize: '1.5rem' }}>
                  {emp.name.charAt(0)}
                </div>
                <h4 style={{ margin: 0, fontWeight: 600 }}>{emp.name}</h4>
                <span className="text-sm text-secondary">{emp.role}</span>
                <span className="text-xs text-tertiary" style={{ marginTop: 'var(--space-2)' }}>{emp.department}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Check-In System */}
      <div className="dashboard-right-panel" style={{ width: 320, flexShrink: 0 }}>
        <div className="card attendance-widget" style={{ position: 'sticky', top: 'var(--space-6)' }}>
          <div className="card-header">
            <h3 className="card-title">Attendance</h3>
          </div>
          <div style={{ padding: 'var(--space-4) 0', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
              {clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {/* Status badge — green when active, red when checked out / not checked in */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 20, fontWeight: 600, marginBottom: 'var(--space-6)',
              background: isCheckedIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isCheckedIn ? 'var(--success)' : 'var(--error)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isCheckedIn ? 'var(--success)' : 'var(--error)',
                animation: isCheckedIn ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              {isCheckedIn ? 'Checked In' : 'Not Checked In'}
            </div>

            {/* Action button — green for check-in, red for check-out */}
            {isCheckedIn ? (
              <button
                className="btn btn-lg"
                style={{ width: '100%', background: 'var(--error)', color: 'white', fontWeight: 600, transition: 'all 0.3s ease' }}
                onClick={handleCheckOut}
              >
                <LogOut size={18} /> Check Out
              </button>
            ) : (
              <button
                className="btn btn-lg"
                style={{ width: '100%', background: 'var(--success)', color: 'white', fontWeight: 600, transition: 'all 0.3s ease' }}
                onClick={handleCheckIn}
              >
                <LogIn size={18} /> {checkInTime ? 'Check In Again' : 'Check In'}
              </button>
            )}

            {checkInTime && (
              <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-4)' }}>
                {isCheckedIn ? 'Checked in at' : 'Last checked in at'} {new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <EmployeeProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => { setProfileModalOpen(false); setSelectedUserId(null); loadData(); }} 
        userId={selectedUserId}
        viewOnly
      />
    </div>
  );
}
