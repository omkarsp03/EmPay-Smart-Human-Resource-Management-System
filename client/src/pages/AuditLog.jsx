import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api';
import { useToast } from '../components/Toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './AuditLog.css';

export default function AuditLog() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, [page, filter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getAuditLog({ page, limit: 20, action: filter });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load audit logs'); }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / 20);

  const actionBadge = (action) => {
    const map = {
      'Checked In': 'badge-success', 'Checked Out': 'badge-info',
      'User Created': 'badge-primary', 'User Updated': 'badge-warning',
      'User Deleted': 'badge-error', 'Leave Applied': 'badge-info',
      'Leave Approved': 'badge-success', 'Leave Rejected': 'badge-error',
      'Payroll Processed': 'badge-primary', 'Password Changed': 'badge-warning',
      '2FA Enabled': 'badge-success', '2FA Disabled': 'badge-error',
      'Profile Updated': 'badge-info', 'Shift Updated': 'badge-warning',
      'Chatbot Query': 'badge-neutral',
    };
    return <span className={`badge ${map[action] || 'badge-neutral'}`}>{action}</span>;
  };

  const exportCSV = () => {
    const rows = [['Timestamp', 'User', 'Role', 'Action', 'Details']];
    logs.forEach(l => rows.push([l.timestamp, l.userName, l.userRole, l.action, l.details]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'empay_audit_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="audit-log animate-fade-in">
      <div className="page-header">
        <div><h1>Audit Log</h1><p className="text-secondary">Track who changed what and when</p></div>
        <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="audit-filters">
            {['', 'Checked In', 'User Created', 'Leave', 'Payroll', 'Password', '2FA'].map(f => (
              <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => { setFilter(f); setPage(1); }}>
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>
              )) : logs.length === 0 ? (
                <tr><td colSpan={5} className="table-empty">No audit logs found</td></tr>
              ) : logs.map((log, i) => (
                <tr key={i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="text-xs text-tertiary">{new Date(log.timestamp).toLocaleString()}</td>
                  <td>
                    <div className="employee-cell">
                      <div className="avatar avatar-sm">{log.userName?.charAt(0)}</div>
                      <span className="font-medium">{log.userName}</span>
                    </div>
                  </td>
                  <td>{log.userRole}</td>
                  <td>{actionBadge(log.action)}</td>
                  <td className="text-sm text-secondary truncate" style={{ maxWidth: 300 }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="table-pagination">
            <span className="text-sm text-secondary">Page {page} of {totalPages} ({total} entries)</span>
            <div className="pagination-btns">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /> Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
