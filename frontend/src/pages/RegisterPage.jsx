import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!form.username.trim())          e.username = 'Username is required';
    else if (form.username.length < 3)  e.username = 'At least 3 characters';
    if (!form.email.trim())             e.email    = 'Email is required';
    if (!form.password.trim())          e.password = 'Password is required';
    else if (form.password.length < 6)  e.password = 'At least 6 characters';
    if (form.password !== form.confirm) e.confirm  = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/home');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
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
        <div className="auth-sub">Create your account — it's free</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <input
              value={form.username} onChange={set('username')}
              placeholder="cooluser123" autoComplete="username"
            />
            {errors.username && <div className="form-error">{errors.username}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input
              type="email" value={form.email} onChange={set('email')}
              placeholder="you@example.com" autoComplete="email"
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <input
              type="password" value={form.password} onChange={set('password')}
              placeholder="Min 6 characters" autoComplete="new-password"
            />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Confirm Password</label>
            <input
              type="password" value={form.confirm} onChange={set('confirm')}
              placeholder="Repeat password" autoComplete="new-password"
            />
            {errors.confirm && <div className="form-error">{errors.confirm}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-red btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}