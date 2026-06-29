import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!identifier.trim()) { setError('Email or username is required'); return; }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(identifier.trim());
      // Always show success — server never reveals whether account exists
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
          <div className="auth-title">WATCH<span>TOGETHER</span></div>
          <div className="auth-sub" style={{ marginBottom: '1.2rem' }}>
            Check your inbox
          </div>
          <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
            If an account with that email or username exists, we've sent a
            password reset link. It expires in <strong>1 hour</strong>.
          </p>
          <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <Link to="/login">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">WATCH<span>TOGETHER</span></div>
        <div className="auth-sub">Reset your password</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email or Username</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or cooluser123"
              autoComplete="email"
              autoFocus
            />
            {error && <div className="form-error">{error}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-red btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-footer">
          Remember your password?{' '}
          <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
