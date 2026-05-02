import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import { useToast } from '../components/Toast';
import Modal from './Modal';
import { User, FileText, Wallet, Shield, Save, Edit2, AlertCircle } from 'lucide-react';

export default function EmployeeProfileModal({ isOpen, onClose, userId, viewOnly }) {
  const { isAdmin, canManageEmployees, user: currentUser } = useAuth();
  const toast = useToast();
  
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Private Info');
  const [isEditing, setIsEditing] = useState(false);
  
  const [form, setForm] = useState({});

  useEffect(() => {
    if (isOpen && userId) {
      loadEmployee();
      setActiveTab('Private Info');
      setIsEditing(false);
    }
  }, [isOpen, userId]);

  const loadEmployee = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getById(userId);
      setEmployee(res.data);
      setForm({
        name: res.data.name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        department: res.data.department || '',
        role: res.data.role || '',
        status: res.data.status || 'Active',
        skills: res.data.skills?.join(', ') || '',
        certifications: res.data.certifications?.join(', ') || '',
        bankName: res.data.bankDetails?.bankName || '',
        accountNo: res.data.bankDetails?.accountNo || '',
        ifsc: res.data.bankDetails?.ifsc || '',
        pan: res.data.bankDetails?.pan || '',
        uan: res.data.bankDetails?.uan || ''
      });
    } catch {
      toast.error('Failed to load profile');
    }
    setLoading(false);
  };

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        department: form.department,
        role: form.role,
        status: form.status,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        certifications: form.certifications.split(',').map(s => s.trim()).filter(Boolean),
        bankDetails: {
          bankName: form.bankName,
          accountNo: form.accountNo,
          ifsc: form.ifsc,
          pan: form.pan,
          uan: form.uan
        }
      };
      
      await userAPI.update(userId, payload);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      loadEmployee();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'Private Info', icon: User },
    { id: 'Resume', icon: FileText },
    { id: 'Salary Info', icon: Wallet },
    { id: 'Security', icon: Shield },
  ];

  const canEdit = (isAdmin || canManageEmployees) && !viewOnly;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Employee Profile" size="lg" footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {canEdit && !isEditing ? (
          <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
            <Edit2 size={16} /> Edit Profile
          </button>
        ) : <div />}
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={() => {
            if (isEditing) { setIsEditing(false); setForm({...employee}); } 
            else onClose();
          }}>
            {isEditing ? 'Cancel' : 'Close'}
          </button>
          {isEditing && (
            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={16} /> Save Changes
            </button>
          )}
        </div>
      </div>
    }>
      {loading ? (
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-6)', height: '60vh', minHeight: 400 }}>
          {/* Sidebar */}
          <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border-color)', paddingRight: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-3)' }}>{employee?.name?.charAt(0)}</div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)' }}>{employee?.name}</h3>
              <p className="text-secondary text-sm">{employee?.role}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)', border: 'none', background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'all 0.2s'
                  }}
                >
                  <tab.icon size={16} /> {tab.id}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
            
            {activeTab === 'Private Info' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 'var(--space-4)' }}>Private Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group"><label className="form-label">Full Name</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} disabled={!isEditing} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="input" value={form.email} onChange={e => update('email', e.target.value)} disabled={!isEditing} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} disabled={!isEditing} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Address</label><textarea className="input textarea" value={form.address} onChange={e => update('address', e.target.value)} disabled={!isEditing} /></div>
                </div>
              </div>
            )}

            {activeTab === 'Resume' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 'var(--space-4)' }}>Resume & Skills</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group"><label className="form-label">Skills</label><textarea className="input textarea" value={form.skills} onChange={e => update('skills', e.target.value)} disabled={!isEditing} placeholder="Comma separated" /></div>
                  <div className="form-group"><label className="form-label">Certifications</label><textarea className="input textarea" value={form.certifications} onChange={e => update('certifications', e.target.value)} disabled={!isEditing} placeholder="Comma separated" /></div>
                  <div className="form-group"><label className="form-label">Join Date</label><input className="input" value={employee?.joinDate ? new Date(employee.joinDate).toLocaleDateString() : 'N/A'} disabled /></div>
                </div>
              </div>
            )}

            {activeTab === 'Salary Info' && (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <h3>Salary & Bank Information</h3>
                  {!canEdit && <span className="badge badge-warning"><AlertCircle size={14} style={{ marginRight: 4 }}/> Restricted</span>}
                </div>
                
                {canEdit || currentUser._id === employee._id ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group"><label className="form-label">Bank Name</label><input className="input" value={form.bankName} onChange={e => update('bankName', e.target.value)} disabled={!isEditing} /></div>
                    <div className="form-group"><label className="form-label">Account Number</label><input className="input" value={form.accountNo} onChange={e => update('accountNo', e.target.value)} disabled={!isEditing} /></div>
                    <div className="form-group"><label className="form-label">IFSC Code</label><input className="input" value={form.ifsc} onChange={e => update('ifsc', e.target.value)} disabled={!isEditing} /></div>
                    <div className="form-group"><label className="form-label">PAN Number</label><input className="input" value={form.pan} onChange={e => update('pan', e.target.value)} disabled={!isEditing} /></div>
                    <div className="form-group"><label className="form-label">UAN (PF Number)</label><input className="input" value={form.uan} onChange={e => update('uan', e.target.value)} disabled={!isEditing} /></div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'var(--bg-tertiary)' }}>
                    <Shield size={32} className="text-secondary" style={{ margin: '0 auto var(--space-2)' }} />
                    <p className="text-secondary">You do not have permission to view salary information for this employee.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Security' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 'var(--space-4)' }}>Security &amp; Role</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group"><label className="form-label">Department</label>
                    <select className="input" value={form.department} onChange={e => update('department', e.target.value)} disabled={!isEditing}>
                      {['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Role</label>
                    <select className="input" value={form.role} onChange={e => update('role', e.target.value)} disabled={!isEditing}>
                      {['Employee', 'HR Officer', 'Payroll Officer', 'Admin'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Status</label>
                    <select className="input" value={form.status} onChange={e => update('status', e.target.value)} disabled={!isEditing}>
                      <option>Active</option><option>Inactive</option><option>On Leave</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Login ID</label>
                    <input className="input" value={employee?.loginId || ''} disabled />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
