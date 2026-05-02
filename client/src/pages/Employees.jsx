import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import EmployeeProfileModal from '../components/EmployeeProfileModal';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import './Employees.css';

const departments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
const roles = ['Employee', 'HR Officer', 'Payroll Officer', 'Admin'];

export default function Employees() {
  const { canManageEmployees, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false); // For creating new employee
  const [profileModalOpen, setProfileModalOpen] = useState(false); // For editing/viewing
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'Employee', department: 'Engineering', phone: '', password: '' });

  useEffect(() => {
    if (user?.role === 'Employee') navigate('/', { replace: true });
  }, [user?.role, navigate]);

  useEffect(() => { loadUsers(); }, [page, search]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getAll({ page, limit: 10, search });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch {}
    setLoading(false);
  };

  const openCreate = () => {
    setForm({ name: '', email: '', role: 'Employee', department: 'Engineering', phone: '', password: '' });
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setSelectedUserId(user._id);
    setProfileModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await userAPI.create(form);
      const d = res.data;
      if (d?.temporaryPassword && d?.loginId) {
        toast.success(`Created. Login ID: ${d.loginId} — Temporary password: ${d.temporaryPassword}`);
      } else {
        toast.success('Employee created');
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await userAPI.delete(id);
      toast.success('Employee deleted');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const totalPages = Math.ceil(total / 10);

  const statusBadge = (status) => (
    <span className={`badge ${status === 'Active' ? 'badge-success' : 'badge-error'}`}>{status}</span>
  );

  const roleBadge = (role) => {
    const map = { Admin: 'badge-error', 'HR Officer': 'badge-primary', 'Payroll Officer': 'badge-warning', Employee: 'badge-info' };
    return <span className={`badge ${map[role] || 'badge-neutral'}`}>{role}</span>;
  };

  if (user?.role === 'Employee') return null;

  return (
    <div className="employees animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p className="text-secondary">{total} team members</p>
        </div>
        {canManageEmployees && (
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Employee</button>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="search-wrapper">
            <Search size={16} />
            <input className="input" placeholder="Search employees..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 36, maxWidth: 300 }} />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Login ID</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Join Date</th>
                {canManageEmployees && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skeleton skeleton-text" /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '55%' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '60%' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '40%' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '50%' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '60%' }} /></td>
                    {canManageEmployees && <td><div className="skeleton skeleton-text" style={{ width: '40%' }} /></td>}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={canManageEmployees ? 7 : 6} className="table-empty">No employees found</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-sm">{user.name?.charAt(0)}</div>
                        <div>
                          <span className="employee-name">{user.name}</span>
                          <span className="employee-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm font-mono">{user.loginId || '—'}</td>
                    <td>{user.department}</td>
                    <td>{roleBadge(user.role)}</td>
                    <td>{statusBadge(user.status)}</td>
                    <td>{user.joinDate ? new Date(user.joinDate).toLocaleDateString() : '—'}</td>
                    {canManageEmployees && (
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(user)}><Edit2 size={14} /></button>
                          {isAdmin && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(user._id, user.name)}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="table-pagination">
            <span className="text-sm text-secondary">Page {page} of {totalPages} ({total} results)</span>
            <div className="pagination-btns">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /> Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Employee" footer={
        <><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Create</button></>
      }>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Full Name</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="input" type="email" value={form.email} onChange={e => update('email', e.target.value)} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Department</label><select className="input" value={form.department} onChange={e => update('department', e.target.value)}>{departments.map(d => <option key={d}>{d}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Role</label><select className="input" value={form.role} onChange={e => update('role', e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Password</label><input className="input" type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Default: password123" /></div>
        </form>
      </Modal>

      <EmployeeProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => { setProfileModalOpen(false); setSelectedUserId(null); loadUsers(); }} 
        userId={selectedUserId} 
      />
    </div>
  );
}
