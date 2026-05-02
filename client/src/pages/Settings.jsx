import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { userAPI } from '../api';
import Modal from '../components/Modal';
import { Sun, Moon, User, Lock, Key, Smartphone, Save, FileText, Wallet, AlertCircle, Send, Pencil, Plus, Info } from 'lucide-react';
import { computeSalaryAmounts, mergeSalaryForm, SALARY_DEFAULTS } from '../utils/salaryStructureCalc';
import './Settings.css';

const ROLE_OPTIONS = ['Employee', 'Admin', 'HR Officer', 'Payroll Officer'];

export default function Settings() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isProfileRoute = location.pathname === '/profile';
  const { user, refreshUser, isAdmin, isHR, isPayroll } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const toast = useToast();

  const canEmailCredentials = isAdmin || isHR;
  const canManageSalaryInfo = isAdmin || isPayroll;

  const [activeTab, setActiveTab] = useState('Resume');

  const [profile, setProfile] = useState({
    name: user?.name || '', phone: user?.phone || '', address: user?.address || '',
    emergencyContact: user?.emergencyContact || '', bloodGroup: user?.bloodGroup || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    skills: user?.skills?.join(', ') || '',
    certifications: user?.certifications?.join(', ') || '',
    about: user?.about || '',
    jobLove: user?.jobLove || '',
    hobbies: user?.hobbies || '',
    personalEmail: user?.personalEmail || '',
    gender: user?.gender || '',
    maritalStatus: user?.maritalStatus || '',
    nationality: user?.nationality || '',
  });
  const [bank, setBank] = useState({
    bankName: '',
    accountNo: '',
    ifsc: '',
    pan: '',
    uan: '',
    empCode: '',
  });
  const [skillDraft, setSkillDraft] = useState('');
  const [certDraft, setCertDraft] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [employeeReset, setEmployeeReset] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [twoFAModal, setTwoFAModal] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const is2FAEnabled = user?.twoFactorEnabled;

  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [credentialsUsers, setCredentialsUsers] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [sendingCredId, setSendingCredId] = useState(null);
  const [managerName, setManagerName] = useState('—');

  const [salaryUsers, setSalaryUsers] = useState([]);
  const [salaryListLoading, setSalaryListLoading] = useState(false);
  const [salaryTargetId, setSalaryTargetId] = useState(null);
  const [salaryForm, setSalaryForm] = useState(() => mergeSalaryForm(SALARY_DEFAULTS));
  const [salaryDetailLoading, setSalaryDetailLoading] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);

  const salaryComputed = useMemo(() => computeSalaryAmounts(salaryForm), [salaryForm]);

  useEffect(() => {
    if (activeTab === 'Salary Info' && !canManageSalaryInfo) setActiveTab('Resume');
  }, [activeTab, canManageSalaryInfo]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'private') setActiveTab('Private Info');
    else if (t === 'resume') setActiveTab('Resume');
    else if (t === 'salary' && canManageSalaryInfo) setActiveTab('Salary Info');
    else if (t === 'security') setActiveTab('Security');
    else if (t === 'preferences') setActiveTab('Preferences');
  }, [searchParams, canManageSalaryInfo]);

  useEffect(() => {
    if (!user?._id) return;
    setProfile((p) => ({
      ...p,
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      emergencyContact: user.emergencyContact || '',
      bloodGroup: user.bloodGroup || '',
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
      skills: Array.isArray(user.skills) ? user.skills.join(', ') : '',
      certifications: Array.isArray(user.certifications) ? user.certifications.join(', ') : '',
      about: user.about || '',
      jobLove: user.jobLove || '',
      hobbies: user.hobbies || '',
      personalEmail: user.personalEmail || '',
      gender: user.gender || '',
      maritalStatus: user.maritalStatus || '',
      nationality: user.nationality || '',
    }));
    setBank({
      bankName: user.bankDetails?.bankName || '',
      accountNo: user.bankDetails?.accountNo || '',
      ifsc: user.bankDetails?.ifsc || '',
      pan: user.bankDetails?.pan || '',
      uan: user.bankDetails?.uan || '',
      empCode: user.bankDetails?.empCode || user.loginId || '',
    });
  }, [user]);

  useEffect(() => {
    if (!user?.managerId) {
      setManagerName('—');
      return;
    }
    let cancelled = false;
    userAPI.getById(user.managerId).then((res) => {
      if (!cancelled) setManagerName(res.data?.name || '—');
    }).catch(() => { if (!cancelled) setManagerName('—'); });
    return () => { cancelled = true; };
  }, [user?.managerId]);

  const updateProfile = (k, v) => setProfile(prev => ({ ...prev, [k]: v }));

  const appendSkill = () => {
    const t = skillDraft.trim();
    if (!t) return;
    const cur = profile.skills.split(',').map((s) => s.trim()).filter(Boolean);
    if (cur.includes(t)) return toast.error('Skill already listed');
    updateProfile('skills', [...cur, t].join(', '));
    setSkillDraft('');
  };

  const appendCert = () => {
    const t = certDraft.trim();
    if (!t) return;
    const cur = profile.certifications.split(',').map((s) => s.trim()).filter(Boolean);
    if (cur.includes(t)) return toast.error('Certification already listed');
    updateProfile('certifications', [...cur, t].join(', '));
    setCertDraft('');
  };

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      await userAPI.updateProfile({
        ...profile,
        skills: profile.skills.split(',').map(s => s.trim()).filter(Boolean),
        certifications: profile.certifications.split(',').map(s => s.trim()).filter(Boolean),
        bankDetails: {
          bankName: bank.bankName,
          accountNo: bank.accountNo,
          ifsc: bank.ifsc,
          pan: bank.pan,
          uan: bank.uan,
          empCode: bank.empCode,
        },
      });
      toast.success('Profile updated successfully!');
      if (refreshUser) refreshUser();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setProfileLoading(false);
  };

  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await userAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed!');
      setPwModal(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEmployeeResetPassword = async () => {
    if (employeeReset.newPassword !== employeeReset.confirmPassword) return toast.error('Passwords do not match');
    if (employeeReset.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await userAPI.changePassword({ currentPassword: employeeReset.currentPassword, newPassword: employeeReset.newPassword });
      toast.success('Password reset successfully.');
      setEmployeeReset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEnable2FA = async () => {
    try {
      const res = await userAPI.enable2FA();
      setTwoFASecret(res.data);
      setTwoFAModal(true);
    } catch { toast.error('Failed to enable 2FA'); }
  };

  const handleDisable2FA = async () => {
    try {
      await userAPI.disable2FA();
      toast.success('2FA disabled');
      if (refreshUser) refreshUser();
    } catch { toast.error('Failed'); }
  };

  const handleVerify2FA = async () => {
    try {
      await userAPI.verify2FA({ code: twoFACode });
      toast.success('2FA verified and enabled!');
      setTwoFAModal(false);
      setTwoFACode('');
      if (refreshUser) refreshUser();
    } catch { toast.error('Invalid code'); }
  };

  const tabs = [
    ...(isAdmin ? [{ id: 'User Setting', icon: Key }] : []),
    { id: 'Resume', icon: FileText },
    { id: 'Private Info', icon: User },
    ...(canManageSalaryInfo ? [{ id: 'Salary Info', icon: Wallet }] : []),
    { id: 'Security', icon: Lock },
    { id: 'Preferences', icon: Sun },
  ];

  useEffect(() => {
    if (activeTab !== 'User Setting' || !isAdmin) return;
    (async () => {
      setUsersLoading(true);
      try {
        const res = await userAPI.getAll({ page: 1, limit: 200 });
        setUsersList(res.data.users || []);
      } catch {}
      setUsersLoading(false);
    })();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab !== 'Security' || !canEmailCredentials) return;
    (async () => {
      setCredentialsLoading(true);
      try {
        const res = await userAPI.getAll({ page: 1, limit: 300 });
        setCredentialsUsers(res.data.users || []);
      } catch {}
      setCredentialsLoading(false);
    })();
  }, [activeTab, canEmailCredentials]);

  useEffect(() => {
    if (activeTab !== 'Salary Info' || !canManageSalaryInfo) return;
    (async () => {
      setSalaryListLoading(true);
      try {
        const res = await userAPI.getAll({ page: 1, limit: 300 });
        const list = res.data.users || [];
        setSalaryUsers(list);
        setSalaryTargetId((prev) => {
          if (prev && list.some((u) => u._id === prev)) return prev;
          return list[0]?._id || null;
        });
      } catch {
        setSalaryUsers([]);
      }
      setSalaryListLoading(false);
    })();
  }, [activeTab, canManageSalaryInfo]);

  useEffect(() => {
    if (!salaryTargetId || !canManageSalaryInfo) return;
    let cancelled = false;
    (async () => {
      setSalaryDetailLoading(true);
      try {
        const res = await userAPI.getById(salaryTargetId);
        if (cancelled) return;
        const u = res.data;
        setSalaryForm(mergeSalaryForm({ ...SALARY_DEFAULTS, ...(u.salaryStructure || {}) }));
      } catch {
        if (!cancelled) setSalaryForm(mergeSalaryForm(SALARY_DEFAULTS));
      }
      if (!cancelled) setSalaryDetailLoading(false);
    })();
    return () => { cancelled = true; };
  }, [salaryTargetId, canManageSalaryInfo]);

  const handleSaveSalaryStructure = async () => {
    if (!salaryTargetId) return;
    if (!salaryComputed.valid) {
      toast.error('Earnings exceed monthly wage. Adjust basic %, HRA, standard allowance, or bonuses.');
      return;
    }
    setSalarySaving(true);
    try {
      await userAPI.updateSalaryStructure(salaryTargetId, salaryForm);
      toast.success('Salary structure saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
    setSalarySaving(false);
  };

  const handleUserRoleChange = async (id, role) => {
    try {
      await userAPI.update(id, { role });
      toast.success('Access rights updated for this user.');
      setUsersList((list) => list.map((u) => (u._id === id ? { ...u, role } : u)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const sendCredentialsMail = async (u) => {
    if (u._id === user?._id) {
      toast.error('Use Change password for your own account.');
      return;
    }
    setSendingCredId(u._id);
    try {
      await userAPI.emailCredentials(u._id);
      toast.success(`Credentials sent to ${u.email} (in-app notification; add SMTP for real email).`);
      if (activeTab === 'Security' && canEmailCredentials) {
        const res = await userAPI.getAll({ page: 1, limit: 300 });
        setCredentialsUsers(res.data.users || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send credentials');
    }
    setSendingCredId(null);
  };

  return (
    <div className="settings animate-fade-in">
      <div className="page-header">
        <div>
          <h1>{isProfileRoute ? 'My Profile' : 'Profile & Settings'}</h1>
          <p className="text-secondary">
            {isProfileRoute
              ? 'Your identity, private details, bank information, and security.'
              : 'Manage your personal information, security, and preferences.'}
          </p>
        </div>
      </div>

      <div className="settings-layout" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
        
        {/* Left Sidebar: Navigation & Identity */}
        <div className="settings-sidebar card" style={{ width: 280, flexShrink: 0, padding: 0, overflow: 'hidden' }}>
          <div className="settings-profile-header" style={{ padding: 'var(--space-6)', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
            <div className="avatar avatar-xl" style={{ margin: '0 auto var(--space-3)' }}>{user?.name?.charAt(0)}</div>
            <h3 style={{ margin: 0 }}>{user?.name}</h3>
            <p className="text-secondary text-sm" style={{ margin: '4px 0 0' }}>{user?.designation || user?.role}</p>
            <span className="badge badge-primary" style={{ marginTop: 'var(--space-2)' }}>{user?.department}</span>
          </div>
          
          <div className="settings-tabs" style={{ padding: 'var(--space-3)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', 
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', 
                  background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <tab.icon size={18} /> {tab.id}
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="settings-content card" style={{ flex: 1, padding: 'var(--space-6)' }}>
          <div
            className="settings-profile-ribbon"
            style={{
              marginBottom: 'var(--space-6)',
              padding: 'var(--space-5)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-6)',
              alignItems: 'start',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className="avatar avatar-xl">{user?.name?.charAt(0)}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ position: 'absolute', bottom: -2, right: -2, borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                  title="Change photo"
                  onClick={() => toast.success('Photo upload can be wired to your storage provider.')}
                >
                  <Pencil size={14} />
                </button>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: '0 0 4px' }}>{user?.name}</h2>
                <p className="text-secondary text-sm" style={{ margin: '0 0 var(--space-3)' }}>{user?.designation || user?.role}</p>
                <div style={{ display: 'grid', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                  <div>
                    <span className="text-secondary">Login ID</span>
                    <div className="font-mono">{user?.loginId || '—'}</div>
                  </div>
                  <div>
                    <span className="text-secondary">Email</span>
                    <div>{user?.email}</div>
                  </div>
                  <div>
                    <span className="text-secondary">Mobile</span>
                    <div>{profile.phone || user?.phone || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div><span className="text-secondary">Company</span><div>{user?.companyName || '—'}</div></div>
              <div><span className="text-secondary">Department</span><div>{user?.department || '—'}</div></div>
              <div><span className="text-secondary">Manager</span><div>{managerName}</div></div>
              <div><span className="text-secondary">Location</span><div>{user?.location || '—'}</div></div>
            </div>
          </div>

          {activeTab === 'User Setting' && isAdmin && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 'var(--space-2)' }}>User Setting</h2>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
                Select access rights per role. Module visibility follows role defaults (Employees, Attendance, Time Off, Payroll, Reports, Settings).
              </p>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User name</th>
                      <th>Login id</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr><td colSpan={5}><div className="skeleton skeleton-text" /></td></tr>
                    ) : usersList.length === 0 ? (
                      <tr><td colSpan={5} className="table-empty">No users</td></tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u._id}>
                          <td className="font-medium">{u.name}</td>
                          <td className="font-mono text-sm">{u.loginId || '—'}</td>
                          <td>{u.email}</td>
                          <td>
                            <select
                              className="input"
                              style={{ minWidth: 160 }}
                              value={u.role}
                              onChange={(e) => handleUserRoleChange(u._id, e.target.value)}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={sendingCredId === u._id}
                              onClick={() => sendCredentialsMail(u)}
                            >
                              <Send size={14} /> {sendingCredId === u._id ? 'Sending…' : 'Send mail'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Private Info — wireframe: personal left, bank right */}
          {activeTab === 'Private Info' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Private information</h2>
              <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                Personal details and bank information. Payroll uses this for payouts; missing bank or manager assignments surface on the Payroll dashboard.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-4)' }}>Personal details</h3>
                  <div className="settings-fields" style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div className="form-group"><label className="form-label">Full name</label><input className="input" value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Login ID</label><input className="input font-mono" value={user?.loginId || ''} readOnly disabled /></div>
                    <div className="form-group"><label className="form-label">Work email</label><input className="input" value={user?.email || ''} readOnly disabled /></div>
                    <div className="form-group"><label className="form-label">Mobile</label><input className="input" value={profile.phone} onChange={(e) => updateProfile('phone', e.target.value)} placeholder="+91 9876543210" /></div>
                    <div className="form-group"><label className="form-label">Date of birth</label><input className="input" type="date" value={profile.dateOfBirth} onChange={(e) => updateProfile('dateOfBirth', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Residing address</label><textarea className="input textarea" value={profile.address} onChange={(e) => updateProfile('address', e.target.value)} placeholder="Full residential address" rows={3} /></div>
                    <div className="form-group"><label className="form-label">Nationality</label><input className="input" value={profile.nationality} onChange={(e) => updateProfile('nationality', e.target.value)} placeholder="e.g. Indian" /></div>
                    <div className="form-group"><label className="form-label">Personal email</label><input className="input" type="email" value={profile.personalEmail} onChange={(e) => updateProfile('personalEmail', e.target.value)} placeholder="you@personal.com" /></div>
                    <div className="form-group"><label className="form-label">Gender</label><select className="input" value={profile.gender} onChange={(e) => updateProfile('gender', e.target.value)}><option value="">Select</option>{['Female', 'Male', 'Non-binary', 'Prefer not to say'].map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Marital status</label><select className="input" value={profile.maritalStatus} onChange={(e) => updateProfile('maritalStatus', e.target.value)}><option value="">Select</option>{['Single', 'Married', 'Partnered', 'Widowed', 'Divorced'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Date of joining</label><input className="input" value={user?.joinDate ? new Date(user.joinDate).toLocaleDateString() : '—'} readOnly disabled /></div>
                    <div className="form-group"><label className="form-label">Blood group</label><select className="input" value={profile.bloodGroup} onChange={(e) => updateProfile('bloodGroup', e.target.value)}><option value="">Select</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Emergency contact</label><input className="input" value={profile.emergencyContact} onChange={(e) => updateProfile('emergencyContact', e.target.value)} placeholder="Name — Phone" /></div>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-4)' }}>Bank details</h3>
                  <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>Required for salary credit. Updates here clear “missing bank” warnings on the payroll dashboard.</p>
                  <div className="settings-fields" style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div className="form-group"><label className="form-label">Account number</label><input className="input font-mono" value={bank.accountNo} onChange={(e) => setBank((b) => ({ ...b, accountNo: e.target.value }))} autoComplete="off" /></div>
                    <div className="form-group"><label className="form-label">Bank name</label><input className="input" value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">IFSC code</label><input className="input font-mono" value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">PAN no.</label><input className="input font-mono" value={bank.pan} onChange={(e) => setBank((b) => ({ ...b, pan: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">UAN no.</label><input className="input font-mono" value={bank.uan} onChange={(e) => setBank((b) => ({ ...b, uan: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Emp code</label><input className="input font-mono" value={bank.empCode} onChange={(e) => setBank((b) => ({ ...b, empCode: e.target.value }))} placeholder={user?.loginId || ''} /></div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
                <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileLoading}>
                  <Save size={16} /> {profileLoading ? 'Saving...' : 'Save private info'}
                </button>
              </div>
            </div>
          )}

          {/* TAB: Resume */}
          {activeTab === 'Resume' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 'var(--space-6)' }}>Resume</h2>
              <div className="settings-fields" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">About</label>
                  <textarea className="input textarea" rows={3} value={profile.about} onChange={(e) => updateProfile('about', e.target.value)} placeholder="Short professional summary" />
                </div>
                <div className="form-group">
                  <label className="form-label">What I love about my job</label>
                  <textarea className="input textarea" rows={3} value={profile.jobLove} onChange={(e) => updateProfile('jobLove', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">My interests and hobbies</label>
                  <textarea className="input textarea" rows={3} value={profile.hobbies} onChange={(e) => updateProfile('hobbies', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {profile.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                      <span key={s} className="badge badge-primary">{s}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: '1 1 200px' }} value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} placeholder="Add a skill" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), appendSkill())} />
                    <button type="button" className="btn btn-secondary" onClick={appendSkill}><Plus size={16} /> Add skill</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Certifications</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {profile.certifications.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                      <span key={s} className="badge badge-warning">{s}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: '1 1 200px' }} value={certDraft} onChange={(e) => setCertDraft(e.target.value)} placeholder="Add a certification" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), appendCert())} />
                    <button type="button" className="btn btn-secondary" onClick={appendCert}><Plus size={16} /> Add certification</button>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
                <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileLoading}>
                  <Save size={16} /> {profileLoading ? 'Saving...' : 'Save resume'}
                </button>
              </div>
            </div>
          )}

          {/* TAB: Salary Info — Admin & Payroll Officer only */}
          {activeTab === 'Salary Info' && canManageSalaryInfo && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
                <div>
                  <h2 style={{ marginBottom: 'var(--space-2)' }}>Salary structure</h2>
                  <p className="text-secondary text-sm">Configure monthly wage, earnings split, and statutory deductions. Amounts recalculate when wage or basic salary changes.</p>
                </div>
                {!salaryComputed.valid && (
                  <div className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
                    <AlertCircle size={14} /> Earnings exceed monthly wage
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-6)', maxWidth: 480 }}>
                <label className="form-label">Employee</label>
                <select
                  className="input"
                  value={salaryTargetId || ''}
                  disabled={salaryListLoading || salaryUsers.length === 0}
                  onChange={(e) => setSalaryTargetId(e.target.value || null)}
                >
                  {salaryUsers.length === 0 ? (
                    <option value="">No users loaded</option>
                  ) : (
                    salaryUsers.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} — {u.email} ({u.role})</option>
                    ))
                  )}
                </select>
              </div>

              {salaryDetailLoading ? (
                <div className="skeleton skeleton-text" style={{ height: 240 }} />
              ) : (
                <>
                  <div className="settings-fields salary-wage-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Month wage</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={100}
                        value={salaryForm.monthWage}
                        onChange={(e) => {
                          const M = Math.max(0, parseFloat(e.target.value) || 0);
                          setSalaryForm((p) => ({ ...p, monthWage: M }));
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Yearly wage</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={1200}
                        value={salaryComputed.yearlyWage}
                        onChange={(e) => {
                          const y = Math.max(0, parseFloat(e.target.value) || 0);
                          setSalaryForm((p) => ({ ...p, monthWage: Math.round((y / 12) * 100) / 100 }));
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Working days / week</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={7}
                        value={salaryForm.workingDaysPerWeek}
                        onChange={(e) => setSalaryForm((p) => ({ ...p, workingDaysPerWeek: parseInt(e.target.value, 10) || 5 }))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Break time (hours)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.25}
                        value={salaryForm.breakTimeHours}
                        onChange={(e) => setSalaryForm((p) => ({ ...p, breakTimeHours: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-4)' }}>Salary components</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                          <div>
                            <div className="font-medium">Basic salary</div>
                            <div className="text-xs text-secondary">% of monthly wage · HRA & bonuses use basic</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono">{salaryComputed.amounts.basic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.basicOfWage.toFixed(2)}% of wage</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input className="input" style={{ width: 100 }} type="number" min={0} max={100} step={0.01} value={salaryForm.basicPctOfWage} onChange={(e) => setSalaryForm((p) => ({ ...p, basicPctOfWage: parseFloat(e.target.value) || 0 }))} title="Percent of monthly wage" />
                            <span className="text-sm text-secondary">% of wage</span>
                            <input
                              className="input"
                              style={{ width: 120 }}
                              type="number"
                              min={0}
                              step={1}
                              value={salaryComputed.amounts.basic}
                              onChange={(e) => {
                                const amt = parseFloat(e.target.value) || 0;
                                setSalaryForm((p) => ({
                                  ...p,
                                  basicPctOfWage: p.monthWage > 0 ? Math.min(100, Math.max(0, (amt / p.monthWage) * 100)) : 0,
                                }));
                              }}
                              title="Edit amount (updates % of wage)"
                            />
                            <span className="text-sm text-secondary">/ month</span>
                          </div>
                        </div>

                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)' }}>
                          <div>
                            <div className="font-medium">House rent allowance (HRA)</div>
                            <div className="text-xs text-secondary">% of basic salary</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono">{salaryComputed.amounts.hra.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.hraOfWage.toFixed(2)}% of wage</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <input className="input" style={{ width: 120 }} type="number" min={0} max={100} step={0.01} value={salaryForm.hraPctOfBasic} onChange={(e) => setSalaryForm((p) => ({ ...p, hraPctOfBasic: parseFloat(e.target.value) || 0 }))} /> % of basic
                          </div>
                        </div>

                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto' }}>
                          <div>
                            <div className="font-medium">Standard allowance</div>
                            <div className="text-xs text-secondary">Fixed monthly amount</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono">{salaryComputed.amounts.standardAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.standardOfWage.toFixed(2)}% of wage</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <input className="input" style={{ maxWidth: 160 }} type="number" min={0} step={1} value={salaryForm.standardAllowanceMonthly} onChange={(e) => setSalaryForm((p) => ({ ...p, standardAllowanceMonthly: parseFloat(e.target.value) || 0 }))} />
                          </div>
                        </div>

                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto' }}>
                          <div>
                            <div className="font-medium">Performance bonus</div>
                            <div className="text-xs text-secondary">% of basic</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono">{salaryComputed.amounts.performanceBonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.performanceOfWage.toFixed(2)}% of wage</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <input className="input" style={{ width: 120 }} type="number" min={0} max={100} step={0.01} value={salaryForm.performanceBonusPctOfBasic} onChange={(e) => setSalaryForm((p) => ({ ...p, performanceBonusPctOfBasic: parseFloat(e.target.value) || 0 }))} /> % of basic
                          </div>
                        </div>

                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto' }}>
                          <div>
                            <div className="font-medium">Leave travel allowance (LTA)</div>
                            <div className="text-xs text-secondary">% of basic</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono">{salaryComputed.amounts.lta.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.ltaOfWage.toFixed(2)}% of wage</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <input className="input" style={{ width: 120 }} type="number" min={0} max={100} step={0.01} value={salaryForm.ltaPctOfBasic} onChange={(e) => setSalaryForm((p) => ({ ...p, ltaPctOfBasic: parseFloat(e.target.value) || 0 }))} /> % of basic
                          </div>
                        </div>

                        <div className="salary-row card" style={{ padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr auto', background: 'var(--bg-tertiary)' }}>
                          <div>
                            <div className="font-medium">Fixed allowance</div>
                            <div className="text-xs text-secondary">Balancing amount: wage − (basic + HRA + standard + bonus + LTA)</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font-mono" style={{ color: !salaryComputed.valid ? 'var(--error)' : undefined }}>{salaryComputed.amounts.fixedAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-secondary">{salaryComputed.displayPct.fixedOfWage.toFixed(2)}% of wage</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-4)' }}>Deductions & contributions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div className="salary-row card" style={{ padding: 'var(--space-3)' }}>
                          <div className="font-medium" style={{ marginBottom: 'var(--space-2)' }}>Provident fund — employee</div>
                          <div className="font-mono" style={{ marginBottom: 8 }}>{salaryComputed.amounts.pfEmployee.toLocaleString(undefined, { minimumFractionDigits: 2 })} / month</div>
                          <input className="input" style={{ width: 120 }} type="number" min={0} max={100} step={0.01} value={salaryForm.pfEmployeePctOfBasic} onChange={(e) => setSalaryForm((p) => ({ ...p, pfEmployeePctOfBasic: parseFloat(e.target.value) || 0 }))} /> % of basic
                        </div>
                        <div className="salary-row card" style={{ padding: 'var(--space-3)' }}>
                          <div className="font-medium" style={{ marginBottom: 'var(--space-2)' }}>Provident fund — employer</div>
                          <div className="font-mono" style={{ marginBottom: 8 }}>{salaryComputed.amounts.pfEmployer.toLocaleString(undefined, { minimumFractionDigits: 2 })} / month</div>
                          <input className="input" style={{ width: 120 }} type="number" min={0} max={100} step={0.01} value={salaryForm.pfEmployerPctOfBasic} onChange={(e) => setSalaryForm((p) => ({ ...p, pfEmployerPctOfBasic: parseFloat(e.target.value) || 0 }))} /> % of basic
                        </div>
                        <div className="salary-row card" style={{ padding: 'var(--space-3)' }}>
                          <div className="font-medium" style={{ marginBottom: 'var(--space-2)' }}>Professional tax</div>
                          <div className="font-mono" style={{ marginBottom: 8 }}>{salaryComputed.amounts.professionalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} / month (fixed)</div>
                          <input className="input" style={{ maxWidth: 160 }} type="number" min={0} step={1} value={salaryForm.professionalTax} onChange={(e) => setSalaryForm((p) => ({ ...p, professionalTax: parseFloat(e.target.value) || 0 }))} />
                        </div>
                      </div>

                      <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <Info size={18} className="text-primary" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div className="text-sm text-secondary">
                            <strong className="text-primary">Rules:</strong> Basic is a % of monthly wage. HRA, performance bonus, and LTA are % of basic. Standard allowance is a fixed amount.
                            Fixed allowance is the remainder so components sum to the monthly wage. PF rates apply to basic (configurable). Saving is blocked if earnings exceed the wage.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveSalaryStructure} disabled={salarySaving || !salaryComputed.valid || !salaryTargetId}>
                      <Save size={16} /> {salarySaving ? 'Saving…' : 'Save salary structure'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: Security */}
          {activeTab === 'Security' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Security</h2>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
                Password management works differently for administrators (who can reset and notify employees) and for employees (who change their own password).
              </p>

              {canEmailCredentials && (
                <div style={{ marginBottom: 'var(--space-8)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)' }}>Password management — team credentials</h3>
                  <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                    Employees receive their login ID and a new temporary password via in-app notification (replace with SMTP in production). Passwords are never shown in this table.
                  </p>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Log in ID</th>
                          <th>Password</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentialsLoading ? (
                          <tr><td colSpan={4}><div className="skeleton skeleton-text" /></td></tr>
                        ) : credentialsUsers.length === 0 ? (
                          <tr><td colSpan={4} className="table-empty">No users</td></tr>
                        ) : (
                          credentialsUsers.map((u) => (
                            <tr key={u._id}>
                              <td>{u.email}</td>
                              <td className="font-mono text-sm">{u.loginId || '—'}</td>
                              <td className="text-secondary font-mono">••••••••</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={sendingCredId === u._id || u._id === user?._id}
                                  onClick={() => sendCredentialsMail(u)}
                                >
                                  <Send size={14} /> {sendingCredId === u._id ? 'Sending…' : 'Send mail'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-5)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
                  {canEmailCredentials ? 'Your password' : 'Reset password'}
                </h3>
                {!canEmailCredentials ? (
                  <>
                    <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                      Your login ID is filled in automatically. Enter your current password and choose a new one.
                    </p>
                    <div className="settings-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                      <div className="form-group">
                        <label className="form-label">Login Id</label>
                        <input className="input font-mono" value={user?.loginId || user?.email || ''} readOnly disabled />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Old password</label>
                        <input className="input" type="password" autoComplete="current-password" value={employeeReset.currentPassword} onChange={(e) => setEmployeeReset((p) => ({ ...p, currentPassword: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">New password</label>
                        <input className="input" type="password" autoComplete="new-password" value={employeeReset.newPassword} onChange={(e) => setEmployeeReset((p) => ({ ...p, newPassword: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm password</label>
                        <input className="input" type="password" autoComplete="new-password" value={employeeReset.confirmPassword} onChange={(e) => setEmployeeReset((p) => ({ ...p, confirmPassword: e.target.value }))} />
                      </div>
                    </div>
                    <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={handleEmployeeResetPassword}>
                      Reset password
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>Change your own password (modal).</p>
                    <button type="button" className="btn btn-secondary" onClick={() => setPwModal(true)}>
                      <Key size={16} /> Change password
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Two-Factor Authentication</h3>
                <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>Add additional security to your account using two-factor authentication.</p>
                <div className="twofa-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="twofa-info" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <Smartphone size={20} className="text-primary" />
                    <div>
                      <span className="font-medium" style={{ display: 'block' }}>Authenticator App</span>
                      <span className="text-xs text-secondary">{is2FAEnabled ? 'Enabled — your account is secured' : 'Disabled — enable for extra security'}</span>
                    </div>
                  </div>
                  <button className={`btn ${is2FAEnabled ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={is2FAEnabled ? handleDisable2FA : handleEnable2FA}>
                    {is2FAEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Preferences */}
          {activeTab === 'Preferences' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 'var(--space-6)' }}>System Preferences</h2>
              
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Appearance</h3>
                <div className="theme-toggle-card" onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <div className="theme-option" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {isDark ? <Moon size={24} className="text-primary" /> : <Sun size={24} className="text-warning" />}
                    <div>
                      <span className="font-medium" style={{ display: 'block' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                      <span className="text-xs text-secondary">Click to toggle theme</span>
                    </div>
                  </div>
                  <div className={`theme-switch ${isDark ? 'active' : ''}`}><div className="theme-switch-thumb" /></div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Notifications</h3>
                <div className="settings-fields" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {['Email Notifications', 'Leave Updates', 'Payroll Alerts', 'Birthday Reminders', 'Anomaly Alerts'].map(item => (
                    <div key={item} className="settings-toggle-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                      <span>{item}</span>
                      <div className="theme-switch active" style={{ cursor: 'pointer' }}><div className="theme-switch-thumb" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Change Password Modal */}
      <Modal isOpen={pwModal} onClose={() => setPwModal(false)} title="Change Password" size="sm" footer={
        <><button className="btn btn-secondary" onClick={() => setPwModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleChangePassword}>Change</button></>
      }>
        <div className="modal-form">
          <div className="form-group"><label className="form-label">Current Password</label><input className="input" type="password" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">New Password</label><input className="input" type="password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Confirm Password</label><input className="input" type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* 2FA Setup Modal */}
      <Modal isOpen={twoFAModal} onClose={() => setTwoFAModal(false)} title="Set Up Two-Factor Authentication" footer={
        <><button className="btn btn-secondary" onClick={() => setTwoFAModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleVerify2FA}>Verify & Enable</button></>
      }>
        <div className="twofa-setup">
          <div className="twofa-step" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <span className="step-number" style={{ background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</span>
            <div>
              <p className="font-medium">Install an authenticator app</p>
              <p className="text-sm text-secondary">Use Google Authenticator, Authy, or any TOTP app</p>
            </div>
          </div>
          <div className="twofa-step" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <span className="step-number" style={{ background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</span>
            <div>
              <p className="font-medium">Enter this secret key manually</p>
              <code className="twofa-secret" style={{ display: 'inline-block', background: 'var(--bg-tertiary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }}>{twoFASecret?.secret}</code>
            </div>
          </div>
          <div className="twofa-step" style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <span className="step-number" style={{ background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</span>
            <div>
              <p className="font-medium">Enter the 6-digit code</p>
              <input className="input twofa-input" style={{ marginTop: 'var(--space-2)', letterSpacing: 4, fontSize: '1.2rem', textAlign: 'center' }} maxLength={6} placeholder="000000" value={twoFACode} onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
