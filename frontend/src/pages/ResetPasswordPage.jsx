import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { token }        = useParams();   // /reset-password/:token
  const { resetPassword } = useAuth();
  const navigate          = useNavigate();

  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.password)               e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await resetPassword(token, form.password);
      toast.success('Password reset! Welcome back.');
      navigate('/');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Link is invalid or has expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">WATCH<span>TOGETHER</span></div>
        <div className="auth-sub">Choose a new password</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">New Password</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Min 6 characters"
              autoComplete="new-password"
              autoFocus
            />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={set('confirm')}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            {errors.confirm && <div className="form-error">{errors.confirm}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-red btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Saving…' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
