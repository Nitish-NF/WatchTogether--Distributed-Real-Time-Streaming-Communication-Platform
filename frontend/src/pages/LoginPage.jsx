import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]       = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!form.identifier.trim()) e.identifier = 'Email or username is required';
    if (!form.password.trim())   e.password   = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.identifier.trim(), form.password);
      navigate('/home');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">
          WATCH<span>TOGETHER</span>
        </div>
        <div className="auth-sub">Sign in to your account</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* CHANGED: was type="email" field named "email"
                       now accepts email OR username */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email or Username</label>
            <input
              value={form.identifier}
              onChange={set('identifier')}
              placeholder="you@example.com or cooluser123"
              autoComplete="username"
              autoFocus
            />
            {errors.identifier && <div className="form-error">{errors.identifier}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Password
              {/* NEW: forgot password link */}
              <Link
                to="/forgot-password"
                style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text2)' }}
              >
                Forgot password?
              </Link>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-red btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Get Started</Link>
        </div>
      </div>
    </div>
  );
}
