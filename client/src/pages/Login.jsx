import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('EMPADMIN20240001');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const apiMsg = err.response?.data?.message;
      const netMsg =
        err.code === 'ERR_NETWORK' || err.message === 'Network Error'
          ? 'Cannot reach the API. Run the backend (port 5050) and open the app from the Vite dev/preview URL, or set VITE_API_BASE.'
          : null;
      toast.error(apiMsg || netMsg || err.message || 'Login failed');
    }
    setLoading(false);
  };

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
          <h2>Welcome back</h2>
          <p className="text-secondary">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Login ID / Email</label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input className="input input-with-icon" type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="EMP... or you@company.com" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input className="input input-with-icon" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              <button type="button" className="input-action" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>

        <div className="auth-demo">
          <p className="text-xs text-tertiary" style={{ marginBottom: 8 }}>Quick login:</p>
          <div className="demo-accounts">
            {[
              { label: 'Admin', email: 'EMPADMIN20240001', pw: 'admin123' },
              { label: 'HR Officer', email: 'EMPPS20240002', pw: 'hr123' },
              { label: 'Employee', email: 'john@empay.com', pw: 'emp123' },
            ].map(acc => (
              <button key={acc.label} className="btn btn-ghost btn-sm" onClick={() => { setEmail(acc.email); setPassword(acc.pw); }}>
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
