import { useState, useEffect, useMemo, useCallback } from 'react';
import { leaveAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { Plus, Check, X, Search, Save } from 'lucide-react';
import './TimeOff.css';

const LEAVE_TYPES = ['Paid Time Off', 'Sick Leave', 'Unpaid Leave'];

/** Display labels aligned with wireframe copy */
const LEAVE_TYPE_OPTIONS = [
  { value: 'Paid Time Off', label: 'Paid time off' },
  { value: 'Sick Leave', label: 'Sick leave' },
  { value: 'Unpaid Leave', label: 'Unpaid leave' },
];

export default function TimeOff() {
  const { user, canApproveLeaves } = useAuth();
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'Paid Time Off',
    startDate: '',
    endDate: '',
    reason: '',
    attachment: '',
  });
  const [filter, setFilter] = useState('all');
  const [mainTab, setMainTab] = useState('Time Off');
  const [viewTab, setViewTab] = useState('My Time Off');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (canApproveLeaves) setViewTab('Team Requests');
  }, [canApproveLeaves]);

  const [allocForm, setAllocForm] = useState({
    userId: '',
    type: 'Paid Time Off',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    days: '24',
    note: '',
    noEndLimit: true,
  });
  const [employees, setEmployees] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const loadBalances = async () => {
    try {
      const res = await leaveAPI.getBalances();
      setBalances(res.data || {});
    } catch {}
  };

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      if (viewTab === 'My Time Off') params.userId = user._id;
      const res = await leaveAPI.getAll(params);
      setLeaves(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadLeaves();
  }, [filter, viewTab, user._id]);

  useEffect(() => {
    loadBalances();
  }, [user._id, mainTab]);

  const loadAllocations = useCallback(async () => {
    try {
      const res = await leaveAPI.getAllocations();
      const d = res.data;
      setAllocations(Array.isArray(d) ? d : []);
    } catch {}
  }, []);

  const resetAllocationForm = useCallback(() => {
    setAllocForm({
      userId: '',
      type: 'Paid Time Off',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: '',
      days: '24',
      note: '',
      noEndLimit: true,
    });
  }, []);

  useEffect(() => {
    if (mainTab !== 'Allocation' || !canApproveLeaves) return;
    (async () => {
      try {
        const usersRes = await userAPI.getAll({ page: 1, limit: 200 });
        setEmployees(usersRes.data.users || []);
        await loadAllocations();
      } catch {}
    })();
  }, [mainTab, canApproveLeaves, loadAllocations]);

  const daySpan = (start, end) => {
    if (!start || !end) return 0;
    const a = new Date(start);
    const b = new Date(end);
    return Math.max(1, Math.round((b - a) / (86400000)) + 1);
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      await leaveAPI.apply(form);
      toast.success('Time off request submitted');
      setModalOpen(false);
      setForm({ type: 'Paid Time Off', startDate: '', endDate: '', reason: '', attachment: '' });
      loadLeaves();
      loadBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleApprove = async (id) => {
    try {
      await leaveAPI.approve(id);
      toast.success('Approved');
      loadLeaves();
      loadBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleReject = async (id) => {
    try {
      await leaveAPI.reject(id);
      toast.success('Rejected');
      loadLeaves();
      loadBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const fmtLeaveDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    if (!allocForm.userId) {
      toast.error('Please select an employee.');
      return;
    }
    if (!allocForm.validFrom) {
      toast.error('Please set the validity start date (From).');
      return;
    }
    if (!allocForm.noEndLimit && !allocForm.validTo) {
      toast.error('Choose “No limit” or enter an end date.');
      return;
    }
    try {
      await leaveAPI.createAllocation({
        userId: allocForm.userId,
        type: allocForm.type,
        validFrom: allocForm.validFrom,
        validTo: allocForm.noEndLimit ? null : allocForm.validTo,
        days: Number(allocForm.days),
        note: allocForm.note,
        noEndLimit: allocForm.noEndLimit,
      });
      toast.success('Allocation saved — employee balance updated.');
      await loadAllocations();
      loadBalances();
      resetAllocationForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const statusBadge = (status) => {
    const map = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-error' };
    return <span className={`badge ${map[status]}`}>{status}</span>;
  };

  const typeClass = (type) => {
    const t = String(type);
    if (t.includes('Sick')) return 'text-primary';
    if (t.includes('Unpaid')) return 'text-secondary';
    return 'text-primary';
  };

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const filteredLeaves = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter((l) => {
      const name = (l.userName || '').toLowerCase();
      const type = (l.type || '').toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [leaves, search]);

  const summaryCards = (
    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)', minWidth: 200 }}>
        <div className="text-sm text-secondary">Paid time off</div>
        <div className="text-primary" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          {balances['Paid Time Off'] ?? 0} Days Available
        </div>
      </div>
      <div className="card" style={{ padding: 'var(--space-4)', minWidth: 200 }}>
        <div className="text-sm text-secondary">Sick time off</div>
        <div className="text-primary" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          {String(balances['Sick Leave'] ?? 0).padStart(2, '0')} Days Available
        </div>
      </div>
    </div>
  );

  return (
    <div className="leaves animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Time Off</h1>
          <p className="text-secondary">
            {canApproveLeaves
              ? 'For Admin & HR Officer — review team requests, balances, and allocations.'
              : 'Requests, balances, and allocations'}
          </p>
        </div>
      </div>

      <div className="att-tabs" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          className={`analytics-tab ${mainTab === 'Time Off' ? 'active' : ''}`}
          onClick={() => setMainTab('Time Off')}
        >
          Time Off
        </button>
        {canApproveLeaves && (
          <button
            type="button"
            className={`analytics-tab ${mainTab === 'Allocation' ? 'active' : ''}`}
            onClick={() => setMainTab('Allocation')}
          >
            Allocation
          </button>
        )}
      </div>

      {mainTab === 'Allocation' && canApproveLeaves ? (
        <div className="card allocation-card" style={{ padding: 'var(--space-6)' }}>
          <div
            className="allocation-card-header"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Allocate time off</h2>
              <p className="text-secondary text-sm" style={{ margin: 0, maxWidth: 520 }}>
                Grant days to an employee’s balance. Employee and time off type are chosen from your full directory.
                Use <strong>NEW</strong> to clear the form for another entry; <strong>Save</strong> applies the allocation immediately.
              </p>
            </div>
            <div className="allocation-header-actions" style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
              <button type="button" className="btn timeoff-btn-new" onClick={resetAllocationForm}>
                <Plus size={16} /> NEW
              </button>
              <button type="submit" form="timeoff-allocation-form" className="btn btn-secondary">
                <Save size={16} /> Save
              </button>
            </div>
          </div>

          <form id="timeoff-allocation-form" className="modal-form allocation-form" onSubmit={handleSaveAllocation}>
            <div className="form-group">
              <label className="form-label">Employee</label>
              <select
                className="input"
                value={allocForm.userId}
                onChange={(e) => setAllocForm((f) => ({ ...f, userId: e.target.value }))}
                required
              >
                <option value="" disabled>
                  Select employee…
                </option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {[emp.name, emp.department, emp.role].filter(Boolean).join(' — ') || emp.name || 'Employee'}
                  </option>
                ))}
              </select>
              <span className="text-xs text-tertiary" style={{ marginTop: 6, display: 'block' }}>
                Dropdown: all employees in the system
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Time off type</label>
              <select
                className="input"
                value={allocForm.type}
                onChange={(e) => setAllocForm((f) => ({ ...f, type: e.target.value }))}
              >
                {LEAVE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Validity — From</label>
                <input
                  className="input"
                  type="date"
                  value={allocForm.validFrom}
                  onChange={(e) => setAllocForm((f) => ({ ...f, validFrom: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Validity — To</label>
                <select
                  className="input"
                  value={allocForm.noEndLimit ? 'nolimit' : 'until'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAllocForm((f) => ({
                      ...f,
                      noEndLimit: v === 'nolimit',
                      validTo: v === 'nolimit' ? '' : f.validTo,
                    }));
                  }}
                >
                  <option value="nolimit">No limit</option>
                  <option value="until">Specific end date</option>
                </select>
                {!allocForm.noEndLimit && (
                  <input
                    className="input"
                    type="date"
                    style={{ marginTop: 8 }}
                    value={allocForm.validTo}
                    onChange={(e) => setAllocForm((f) => ({ ...f, validTo: e.target.value }))}
                    required={!allocForm.noEndLimit}
                  />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Allocation</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.01}
                  style={{ maxWidth: 160, fontVariantNumeric: 'tabular-nums' }}
                  value={allocForm.days}
                  onChange={(e) => setAllocForm((f) => ({ ...f, days: e.target.value }))}
                  required
                />
                <span className="text-secondary font-medium">Days</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <input
                className="input"
                type="text"
                value={allocForm.note}
                onChange={(e) => setAllocForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Optional comment for HR records"
              />
            </div>
          </form>

          <div style={{ marginTop: 'var(--space-8)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-5)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Recent allocations</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
              Latest entries (updates as soon as you save).
            </p>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Valid from</th>
                    <th>Valid to</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-empty text-tertiary">
                        No allocations yet — save a form above to see it here.
                      </td>
                    </tr>
                  ) : (
                    allocations.slice(0, 12).map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium">{a.userName || '—'}</td>
                        <td>{a.type}</td>
                        <td>{a.days != null ? Number(a.days).toFixed(2) : '—'}</td>
                        <td>{a.validFrom ? fmtLeaveDate(a.validFrom) : '—'}</td>
                        <td>{a.noEndLimit ? 'No limit' : a.validTo ? fmtLeaveDate(a.validTo) : '—'}</td>
                        <td className="text-sm text-secondary">{a.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {canApproveLeaves && (
            <div className="att-tabs timeoff-subtabs" style={{ marginBottom: 'var(--space-4)' }}>
              {['Team Requests', 'My Time Off'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`analytics-tab ${viewTab === tab ? 'active' : ''}`}
                  onClick={() => setViewTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          <div className="timeoff-toolbar card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button type="button" className="btn timeoff-btn-new" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> NEW
            </button>
            <div className="leave-filters" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', minWidth: 0 }}>
              {['all', 'Pending', 'Approved', 'Rejected'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
              <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                <Search size={16} />
                <input
                  className="input"
                  placeholder="Search by name or leave type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
          </div>

          {summaryCards}

          <div className="card" style={{ marginTop: 'var(--space-4)' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {viewTab === 'Team Requests' && <th>Name</th>}
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Time off Type</th>
                    <th>Status</th>
                    {viewTab === 'Team Requests' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(3)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i}>
                          {Array(viewTab === 'Team Requests' ? 6 : 4)
                            .fill(0)
                            .map((_, j) => (
                              <td key={j}>
                                <div className="skeleton skeleton-text" />
                              </td>
                            ))}
                        </tr>
                      ))
                  ) : filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={viewTab === 'Team Requests' ? 6 : 4} className="table-empty">
                        No time off records
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((leave) => (
                      <tr key={leave._id}>
                        {viewTab === 'Team Requests' && (
                          <td>
                            <div className="employee-cell">
                              <div className="avatar avatar-sm">{leave.userName?.charAt(0)}</div>
                              <span>{leave.userName}</span>
                            </div>
                          </td>
                        )}
                        <td>{fmtLeaveDate(leave.startDate)}</td>
                        <td>{fmtLeaveDate(leave.endDate)}</td>
                        <td>
                          <span className={typeClass(leave.type)} style={{ fontWeight: 600 }}>
                            {leave.type}
                          </span>
                        </td>
                        <td>{statusBadge(leave.status)}</td>
                        {viewTab === 'Team Requests' && (
                          <td>
                            {leave.status === 'Pending' ? (
                              <div className="table-actions timeoff-approve-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleReject(leave._id)}
                                  title="Reject request"
                                >
                                  <X size={14} /> Reject
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleApprove(leave._id)}
                                  title="Approve request"
                                >
                                  <Check size={14} /> Approve
                                </button>
                              </div>
                            ) : (
                              <span className="text-tertiary text-xs">Processed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Time off Type Request"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" onClick={handleApply}>
              Submit
            </button>
          </>
        }
      >
        <form className="modal-form" onSubmit={handleApply}>
          <div className="form-group">
            <label className="form-label">Employee</label>
            <input className="input" value={user?.name || ''} readOnly disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Time off Type</label>
            <select className="input" value={form.type} onChange={(e) => update('type', e.target.value)}>
              {LEAVE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input className="input" type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Allocation</label>
            <input
              className="input"
              readOnly
              value={`${daySpan(form.startDate, form.endDate).toFixed(2)} Days`}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <textarea className="input textarea" value={form.reason} onChange={(e) => update('reason', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Attachment note (e.g. sick certificate URL)</label>
            <input className="input" value={form.attachment} onChange={(e) => update('attachment', e.target.value)} placeholder="Optional link or reference" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
