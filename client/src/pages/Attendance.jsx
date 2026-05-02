import { useState, useEffect, useRef, useMemo } from 'react';
import { attendanceAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { LogIn, LogOut, ChevronLeft, ChevronRight, MapPin, Camera, Sun, Moon as MoonIcon, Sunset } from 'lucide-react';
import { getWorkAndExtraHours } from '../utils/attendanceHours';
import './Attendance.css';

export default function Attendance() {
  const { user, canManageEmployees } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [todayRecords, setTodayRecords] = useState([]);
  const [, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [adminDay, setAdminDay] = useState(new Date());
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [geoLocation, setGeoLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selfieData, setSelfieData] = useState(null);
  const [shifts, setShifts] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  /** Advances while someone is checked in without checkout so work hours stay current */
  const [hoursNow, setHoursNow] = useState(() => new Date());

  useEffect(() => {
    if (canManageEmployees) setActiveTab('today');
  }, [canManageEmployees]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => { loadData(); getLocation(); }, [currentMonth, adminDay]);

  const loadData = async () => {
    setLoading(true);
    try {
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const adminDateStr = adminDay.toISOString().split('T')[0];
      const [myAtt, todayAtt, shiftData] = await Promise.all([
        attendanceAPI.getByUser(user._id, { month }),
        canManageEmployees
          ? attendanceAPI.getToday({ date: adminDateStr })
          : Promise.resolve({ data: { records: [], stats: {} } }),
        canManageEmployees ? attendanceAPI.getShifts().catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setRecords(myAtt.data.records || []);
      setStats(myAtt.data.stats || {});
      setTodayRecords(todayAtt.data.records || []);
      if (shiftData.data) setShifts(shiftData.data);

      const today = new Date().toISOString().split('T')[0];
      const todayRecord = (myAtt.data.records || []).find(r => r.date === today);
      setCheckedIn(!!todayRecord);
      setCheckedOut(!!todayRecord?.checkOut);
      setHoursNow(new Date());
    } catch {}
    setLoading(false);
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoError(null); },
        () => { setGeoError('Location access denied. Marking as manual.'); }
      );
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { toast.error('Camera access denied'); setShowCamera(false); }
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = 320;
      canvasRef.current.height = 240;
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const data = canvasRef.current.toDataURL('image/jpeg', 0.6);
      setSelfieData(data);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  useEffect(() => () => stopCamera(), []);

  const handleMark = async () => {
    try {
      const payload = {};
      if (geoLocation) { payload.latitude = geoLocation.lat; payload.longitude = geoLocation.lng; }
      if (selfieData) payload.selfieData = 'captured';
      const res = await attendanceAPI.mark(payload);
      toast.success(res.data.message);
      if (res.data.geofence) {
        toast.info(res.data.geofence.withinRange ? '📍 Within office range' : '🏠 Outside office — marked as WFH');
      }
      setSelfieData(null);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(); const month = date.getMonth();
    const first = new Date(year, month, 1); const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    return days;
  };

  const getStatusForDay = (day) => {
    if (!day) return null;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return records.find(r => r.date === dateStr)?.status || null;
  };

  const SHIFT_ICONS = { Morning: <Sun size={14} />, Evening: <Sunset size={14} />, Night: <MoonIcon size={14} /> };
  const SHIFT_COLORS = { Morning: '#0071E3', Evening: '#FF9F0A', Night: '#5E5CE6' };

  const monthRecordsSorted = useMemo(
    () => [...records].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [records]
  );

  const needsLiveHoursTick = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const openToday = (list) =>
      list.some(
        (r) =>
          r.checkIn &&
          !r.checkOut &&
          String(r.date || '').slice(0, 10) === todayStr
      );
    if (canManageEmployees && activeTab === 'today') return openToday(todayRecords);
    if (!canManageEmployees && activeTab === 'list') return openToday(monthRecordsSorted);
    return false;
  }, [canManageEmployees, activeTab, todayRecords, monthRecordsSorted]);

  useEffect(() => {
    if (!needsLiveHoursTick) return;
    const id = setInterval(() => setHoursNow(new Date()), 10000);
    return () => clearInterval(id);
  }, [needsLiveHoursTick]);

  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="attendance animate-fade-in">
      <div className="page-header">
        <div><h1>Attendance</h1><p className="text-secondary">Track attendance with geolocation & selfie</p></div>
        <div className="page-actions">
          {!checkedIn && !showCamera && <button className="btn btn-secondary" onClick={startCamera}><Camera size={16} /> Selfie Check-in</button>}
          <button className="btn btn-primary" onClick={handleMark} disabled={checkedOut}>
            {!checkedIn ? <><LogIn size={16} /> Check In</> : checkedOut ? '✅ Done' : <><LogOut size={16} /> Check Out</>}
          </button>
        </div>
      </div>

      {/* Geo & selfie status */}
      <div className="checkin-extras">
        <div className={`geo-status ${geoLocation ? 'active' : 'inactive'}`}>
          <MapPin size={14} />
          {geoLocation ? `📍 ${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}` : geoError || 'Detecting location...'}
        </div>
        {selfieData && <div className="selfie-preview"><img src={selfieData} alt="Selfie" /><span className="badge badge-success">✓ Selfie captured</span></div>}
      </div>

      {/* Camera modal */}
      {showCamera && (
        <div className="camera-modal card">
          <h4>Take a Selfie</h4>
          <div className="camera-view">
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <div className="camera-actions">
            <button className="btn btn-primary" onClick={captureSelfie}><Camera size={16} /> Capture</button>
            <button className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
          </div>
        </div>
      )}

      <div className="att-stats-grid">
        <div className="att-stat-card"><span className="att-stat-label">Present</span><span className="att-stat-value" style={{ color: 'var(--success)' }}>{stats.present || 0}</span></div>
        <div className="att-stat-card"><span className="att-stat-label">Absent</span><span className="att-stat-value" style={{ color: 'var(--error)' }}>{stats.absent || 0}</span></div>
        <div className="att-stat-card"><span className="att-stat-label">WFH</span><span className="att-stat-value" style={{ color: 'var(--info)' }}>{stats.wfh || 0}</span></div>
        <div className="att-stat-card"><span className="att-stat-label">Rate</span><span className="att-stat-value" style={{ color: 'var(--apple-blue)' }}>{stats.attendanceRate || 0}%</span></div>
        <div className="att-stat-card"><span className="att-stat-label">Hours</span><span className="att-stat-value" style={{ color: 'var(--info)' }}>{stats.totalHours || 0}h</span></div>
      </div>

      {/* Tabs */}
      <div className="att-tabs">
        {!canManageEmployees && (
          <button type="button" className={`analytics-tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
            Month view
          </button>
        )}
        {canManageEmployees && (
          <>
            <button type="button" className={`analytics-tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>
              Day (team)
            </button>
            <button type="button" className={`analytics-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              My Calendar
            </button>
            <button type="button" className={`analytics-tab ${activeTab === 'shifts' ? 'active' : ''}`} onClick={() => setActiveTab('shifts')}>
              Shifts
            </button>
          </>
        )}
      </div>

      {activeTab === 'list' && !canManageEmployees && (
        <div className="card">
          <div className="calendar-header">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}><ChevronLeft size={18} /></button>
            <h3>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="att-stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="att-stat-card"><span className="att-stat-label">Days present</span><span className="att-stat-value" style={{ color: 'var(--success)' }}>{stats.present || 0}</span></div>
            <div className="att-stat-card"><span className="att-stat-label">Leaves (approved)</span><span className="att-stat-value" style={{ color: 'var(--info)' }}>—</span></div>
            <div className="att-stat-card"><span className="att-stat-label">Logged days</span><span className="att-stat-value">{records.length}</span></div>
          </div>
          <div className="table-container" style={{ padding: '0 var(--space-4) var(--space-4)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Work hours</th>
                  <th>Extra hours</th>
                </tr>
              </thead>
              <tbody>
                {monthRecordsSorted.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-tertiary" style={{ padding: 'var(--space-8)' }}>No attendance this month</td></tr>
                ) : (
                  monthRecordsSorted.map((r) => {
                    const { workH, extraH, isLive } = getWorkAndExtraHours(r, hoursNow);
                    return (
                      <tr key={r._id}>
                        <td>{new Date(r.date).toLocaleDateString()}</td>
                        <td>{fmtTime(r.checkIn)}</td>
                        <td>{fmtTime(r.checkOut)}</td>
                        <td className="font-medium" title={isLive ? 'Still checked in — updates every 10s' : undefined}>
                          {workH != null ? `${workH}h${isLive ? ' · live' : ''}` : '—'}
                        </td>
                        <td className="font-medium" style={{ color: extraH > 0 ? 'var(--success)' : 'inherit' }}>{extraH > 0 ? `+${extraH}h` : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="card">
          <div className="calendar-header">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}><ChevronLeft size={18} /></button>
            <h3>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="calendar-day-label">{d}</div>)}
            {getDaysInMonth(currentMonth).map((day, i) => {
              const status = getStatusForDay(day);
              return (
                <div key={i} className={`calendar-cell ${day ? '' : 'empty'} ${status ? `status-${status.toLowerCase()}` : ''}`}>
                  {day && <><span className="calendar-date">{day}</span>{status && <span className="calendar-status-dot" />}</>}
                </div>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }} /> Present</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--info)' }} /> WFH</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--error)' }} /> Absent</span>
          </div>
        </div>
      )}

      {activeTab === 'today' && canManageEmployees && (
        <div className="card">
          <div className="calendar-header" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { const d = new Date(adminDay); d.setDate(d.getDate() - 1); setAdminDay(d); }}><ChevronLeft size={18} /></button>
            <h3 style={{ margin: 0 }}>{adminDay.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { const d = new Date(adminDay); d.setDate(d.getDate() + 1); setAdminDay(d); }}><ChevronRight size={18} /></button>
          </div>
          <div className="card-header"><h3 className="card-title">Attendance</h3><span className="badge badge-primary">{todayRecords.length} records</span></div>
          <div className="table-container" style={{ padding: '0 var(--space-4) var(--space-4)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Work Hours</th>
                  <th>Extra Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-tertiary" style={{ padding: 'var(--space-8)' }}>No records yet</td></tr>
                ) : (
                  todayRecords.map(r => {
                    const checkInTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    const checkOutTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    const { workH, extraH, isLive } = getWorkAndExtraHours(r, hoursNow);

                    return (
                      <tr key={r._id}>
                        <td>
                          <div className="employee-cell" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div className="avatar avatar-sm">{r.userName?.charAt(0)}</div>
                            <div>
                              <span className="font-medium" style={{ display: 'block' }}>{r.userName}</span>
                              <span className="text-xs text-tertiary">{r.userDepartment}</span>
                            </div>
                          </div>
                        </td>
                        <td>{checkInTime}</td>
                        <td>{checkOutTime}</td>
                        <td className="font-medium" title={isLive ? 'In progress — updates every 10s' : undefined}>
                          {workH != null ? `${workH}h${isLive ? ' · live' : ''}` : '—'}
                        </td>
                        <td className="font-medium" style={{ color: extraH > 0 ? 'var(--success)' : 'inherit' }}>
                          {extraH > 0 ? `+${extraH}h` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span className={`badge ${r.status === 'Present' ? 'badge-success' : r.status === 'WFH' ? 'badge-info' : 'badge-error'}`}>{r.status}</span>
                            {r.hasSelfie && <span title="Selfie verified">📷</span>}
                            {r.isWithinGeofence !== null && <span title={r.isWithinGeofence ? 'In Office' : 'Outside Geofence'}>{r.isWithinGeofence ? '📍' : '🏠'}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shifts' && canManageEmployees && shifts && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Shift Management</h3></div>
          <div className="shift-summary">
            {Object.entries(shifts.shifts).map(([key, shift]) => (
              <div key={key} className="shift-card" style={{ borderLeftColor: SHIFT_COLORS[key] }}>
                {SHIFT_ICONS[key]}
                <div>
                  <span className="font-medium">{shift.label}</span>
                  <span className="text-xs text-tertiary" style={{ display: 'block' }}>{shift.start} — {shift.end}</span>
                </div>
                <span className="badge badge-neutral">{shifts.summary[key] || 0}</span>
              </div>
            ))}
          </div>
          <div className="table-container" style={{ marginTop: 'var(--space-4)' }}>
            <table className="data-table">
              <thead><tr><th>Employee</th><th>Department</th><th>Current Shift</th><th>Change</th></tr></thead>
              <tbody>
                {(shifts.assignments || []).slice(0, 15).map(a => (
                  <tr key={a._id}>
                    <td className="font-medium">{a.name}</td>
                    <td>{a.department}</td>
                    <td><span className="badge" style={{ background: SHIFT_COLORS[a.shift] + '22', color: SHIFT_COLORS[a.shift] }}>{SHIFT_ICONS[a.shift]} {a.shift}</span></td>
                    <td>
                      <select className="input" style={{ width: 120, padding: '4px 8px', fontSize: 12 }} value={a.shift} onChange={async (e) => {
                        try { await attendanceAPI.updateShift(a._id, { shift: e.target.value }); toast.success('Shift updated'); loadData(); }
                        catch { toast.error('Failed'); }
                      }}>
                        <option>Morning</option><option>Evening</option><option>Night</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
