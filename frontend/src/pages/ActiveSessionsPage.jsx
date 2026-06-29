import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────
const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)                    return 'just now';
  if (diff < 3600)                  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)                 return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const deviceIcon = (deviceName = '') => {
  const d = deviceName.toLowerCase();
  if (d.includes('iphone') || d.includes('android')) return '📱';
  if (d.includes('ipad'))                             return '📟';
  return '💻';
};

// ─────────────────────────────────────────────────────────────────
export default function ActiveSessionsPage() {
  const { logout, logoutAll } = useAuth();
  const navigate              = useNavigate();

  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [revoking,  setRevoking]  = useState(null);   // sessionId being revoked
  const [loggingAll, setLoggingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await authService.getSessions();
      // Sort most-recently-used first
      setSessions([...data].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)));
    } catch {
      toast.error('Could not load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (sessionId) => {
    setRevoking(sessionId);
    try {
      await authService.revokeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session revoked');
    } catch {
      toast.error('Could not revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Sign out from all devices?')) return;
    setLoggingAll(true);
    try {
      await logoutAll();
      navigate('/login');
    } catch {
      toast.error('Something went wrong');
      setLoggingAll(false);
    }
  };

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '2rem 1rem' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.8rem' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/settings')}
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
            Active Sessions
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>
            Devices currently signed in to your account
          </p>
        </div>
      </div>

      {/* ── Session list ───────────────────────────────────────── */}
      {loading ? (
        // Skeleton rows
        [1, 2, 3].map(n => (
          <div key={n} className="card" style={{
            padding: '1rem 1.2rem', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--surface)', flexShrink: 0,
              animation: 'pulse 1.2s infinite',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                height: 13, width: '55%', borderRadius: 4,
                background: 'var(--surface)', marginBottom: 7,
                animation: 'pulse 1.2s infinite',
              }} />
              <div style={{
                height: 11, width: '35%', borderRadius: 4,
                background: 'var(--surface)',
                animation: 'pulse 1.2s infinite',
              }} />
            </div>
          </div>
        ))
      ) : sessions.length === 0 ? (
        <p className="text-muted">No active sessions found.</p>
      ) : (
        sessions.map((session, i) => (
          <div
            key={session.id}
            className="card"
            style={{
              padding: '1rem 1.2rem',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            {/* Icon */}
            <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>
              {deviceIcon(session.deviceName)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 500, fontSize: '14px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {session.deviceName}
                {i === 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600,
                    background: 'var(--red)', color: '#fff',
                    padding: '1px 7px', borderRadius: '20px',
                    letterSpacing: '0.3px',
                  }}>
                    CURRENT
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>
                Last active {timeAgo(session.lastUsed)}
                {' · '}
                Signed in {new Date(session.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Revoke — hide on current session (would log out this tab) */}
            {i !== 0 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--red)', flexShrink: 0 }}
                disabled={revoking === session.id}
                onClick={() => handleRevoke(session.id)}
              >
                {revoking === session.id ? '…' : 'Revoke'}
              </button>
            )}
          </div>
        ))
      )}

      {/* ── Logout all ─────────────────────────────────────────── */}
      {!loading && sessions.length > 0 && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--red)' }}
            disabled={loggingAll}
            onClick={handleLogoutAll}
          >
            {loggingAll ? 'Signing out…' : 'Sign out from all devices'}
          </button>
        </div>
      )}

    </div>
  );
}
