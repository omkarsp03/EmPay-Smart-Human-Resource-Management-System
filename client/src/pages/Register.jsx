import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({ companyName: '', name: '', email: '', phone: '', password: '', confirmPassword: '', logo: null });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await register({ companyName: form.companyName, name: form.name, email: form.email, phone: form.phone, password: form.password });
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 403) {
        toast.error(msg || 'Registration is closed. Ask HR or an administrator to create your account.');
      } else {
        toast.error(msg || 'Registration failed');
      }
    }
    setLoading(false);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-circle auth-bg-circle-1" />
        <div className="auth-bg-circle auth-bg-circle-2" />
        <div className="auth-bg-circle auth-bg-circle-3" />
      </div>
      <div className="auth-card animate-scale-in">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon"><Zap size={24} /></div>
            <span className="logo-text" style={{ fontSize: '1.5rem' }}>EmPay</span>
          </div>
          <h2>Create account</h2>
          <p className="text-secondary">Start managing your team today</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group" style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            <div className="avatar avatar-lg" style={{ margin: '0 auto var(--space-2)', cursor: 'pointer', background: 'var(--bg-tertiary)' }}>
              <Zap size={24} className="text-secondary" />
            </div>
            <label className="text-sm text-primary" style={{ cursor: 'pointer' }}>
              Upload Company Logo
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => update('logo', e.target.files[0])} />
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="input" value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Acme Corp" required />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-icon-wrapper">
              <User size={16} className="input-icon" />
              <input className="input input-with-icon" value={form.name} onChange={e => update('name', e.target.value)} placeholder="John Doe" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-icon-wrapper">
                <Mail size={16} className="input-icon" />
                <input className="input input-with-icon" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 555-0100" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input className="input input-with-icon" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" required />
              <button type="button" className="input-action" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input className="input input-with-icon" type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="••••••••" required />
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
