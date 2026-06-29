import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import userService from '../services/userService'; // ADD: for updateProfile (name, username, isPrivate)
import toast from 'react-hot-toast';

// ── Section wrapper ────────────────────────────────────────────────
const Section = ({ title, description, children }) => (
  <div style={{
    background: 'var(--bg3)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    marginBottom: '12px',
  }}>
    <div style={{
      padding: '1rem 1.4rem',
      borderBottom: '0.5px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '2px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{title}</div>
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{description}</div>
      )}
    </div>
    <div style={{ padding: '1.2rem 1.4rem' }}>{children}</div>
  </div>
);

// ── Row inside a section ───────────────────────────────────────────
const Row = ({ label, hint, children, last }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '1rem',
    paddingBottom: last ? 0 : '1rem',
    marginBottom: last ? 0 : '1rem',
    borderBottom: last ? 'none' : '0.5px solid var(--border)',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{hint}</div>}
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

// ── Toggle switch ─────────────────────────────────────────────────
const Toggle = ({ value, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!value)}
    style={{
      width: 44, height: 24, borderRadius: 12, border: 'none',
      background: value ? 'var(--red)' : 'var(--border)',
      position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.6 : 1,
    }}
  >
    <span style={{
      position: 'absolute', top: 3, left: value ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%', background: '#fff',
      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </button>
);

// ── Avatar initials ────────────────────────────────────────────────
const Avatar = ({ username, size = 52 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'var(--red)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.3, fontWeight: 700, flexShrink: 0,
    letterSpacing: '0.5px',
  }}>
    {username?.slice(0, 2).toUpperCase()}
  </div>
);

// ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, refreshUser, logout, logoutAll } = useAuth();
  const navigate = useNavigate();

  // ── Identity fields (name + bio) — saved via button ─────────────
  const [name,          setName]          = useState(user?.name || '');
  const [bio,           setBio]           = useState(user?.bio  || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});

  const savedNameRef = useRef(user?.name || '');
  const savedBioRef  = useRef(user?.bio  || '');
  const identityDirty = name !== savedNameRef.current || bio !== savedBioRef.current;

  // ── Privacy toggle — saved instantly, independent of identity ───
  const [isPrivate,     setIsPrivate]     = useState(user?.isPrivate ?? false);
  console.log("usr",user);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Sync identity fields when auth context refreshes after save.
  // isPrivate is intentionally excluded — it has its own instant-save
  // path and syncing it here would reset it mid-flight (the race bug).
  useEffect(() => {
    setName(user?.name || '');
    setBio(user?.bio   || '');
    savedNameRef.current = user?.name || '';
    savedBioRef.current  = user?.bio  || '';
  }, [user]);


  // ── Save name + bio ────────────────────────────────────────────
  const handleSaveProfile = async () => {
    const e = {};
    if (name.length > 50) e.name = 'Max 50 characters';
    setProfileErrors(e);
    if (Object.keys(e).length) return;

    setSavingProfile(true);
    try {
      await userService.updateProfile({ name: name.trim(), bio: bio.trim() });
      await refreshUser();
      savedNameRef.current = name.trim();
      savedBioRef.current  = bio.trim();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Toggle private/public — instant save, no refreshUser ──────
  // Skipping refreshUser avoids the useEffect([user]) sync from
  // overwriting isPrivate state before the API call completes.
  const handleTogglePrivacy = async (val) => {
    setIsPrivate(val);           // optimistic
    setSavingPrivacy(true);
    try {
      await userService.updateProfile({ isPrivate: val });
      toast.success(val ? '🔒 Account set to private' : '🌐 Account set to public');
    } catch {
      setIsPrivate(!val);        // revert on failure
      toast.error('Could not update privacy setting');
    } finally {
      setSavingPrivacy(false);
    }
  };

  useEffect(() => {
  if (user) {
    setIsPrivate(user.isPrivate ?? false);
  }
}, [user]);

  // ── Password tab ───────────────────────────────────────────────
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const [tab, setTab] = useState('profile');

  const validatePw = () => {
    const e = {};
    if (!pwForm.current)                e.current = 'Current password is required';
    if (!pwForm.next)                   e.next    = 'New password is required';
    else if (pwForm.next.length < 6)    e.next    = 'At least 6 characters';
    if (pwForm.next !== pwForm.confirm)  e.confirm = 'Passwords do not match';
    if (pwForm.current === pwForm.next && pwForm.next)
      e.next = 'New password must differ from current';
    setPwErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChangePw = async () => {
    if (!validatePw()) return;
    setSavingPw(true);
    try {
      await authService.changePassword({
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      });
      setPwForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Please sign in again.');
      setTimeout(() => { logout(); navigate('/login'); }, 1500);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout    = async () => { await logout(); navigate('/login'); };
  const handleLogoutAll = async () => {
    if (!window.confirm('Sign out from all devices?')) return;
    await logoutAll(); navigate('/login');
  };

  const setPw = (field) => (e) => setPwForm(prev => ({ ...prev, [field]: e.target.value }));

  const TABS = [
    { key: 'profile',  label: '👤 Profile'  },
    { key: 'security', label: '🔒 Security'  },
    { key: 'sessions', label: '📱 Sessions'  },
  ];
  console.log("user",user)

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>

        {/* ── Page header ──────────────────────────────────────── */}
        <div style={{ marginBottom: '1.8rem' }}>
          <div className="section-eyebrow">Account</div>
          <div className="section-title">Settings</div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.6rem' }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`btn btn-sm ${tab === key ? 'btn-red' : 'btn-ghost'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            PROFILE TAB
        ════════════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <>
            {/* ── Identity card ──────────────────────────────── */}
            <Section title="Identity" description="How others see you">

              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.4rem' }}>
                <Avatar username={user?.username} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {name || user?.username}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text3)' }}>@{user?.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{user?.email}</div>
                </div>
              </div>

              {/* Name (display name) — NEW */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">
                  Display Name
                  <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: '6px' }}>
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name or display name"
                  maxLength={50}
                />
                {profileErrors.name && (
                  <div className="form-error">{profileErrors.name}</div>
                )}
                <div style={{
                  fontSize: '11px', color: name.length > 45 ? 'var(--red)' : 'var(--text3)',
                  marginTop: '4px', textAlign: 'right',
                }}>
                  {name.length}/50
                </div>
              </div>

              {/* Username — read-only */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Username</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px',
                  background: 'var(--bg2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13.5px', color: 'var(--text2)',
                }}>
                  <span style={{ color: 'var(--text3)' }}>@</span>
                  {user?.username}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  Username cannot be changed.
                </div>
              </div>

              {/* Bio */}
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people about yourself…"
                  maxLength={200}
                  rows={3}
                  style={{ resize: 'none' }}
                />
                <div style={{
                  fontSize: '11px', color: bio.length > 180 ? 'var(--red)' : 'var(--text3)',
                  marginTop: '4px', textAlign: 'right',
                }}>
                  {bio.length}/200
                </div>
              </div>

              <button
                className="btn btn-red btn-sm"
                onClick={handleSaveProfile}
                disabled={savingProfile || !identityDirty}
              >
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </Section>

            {/* ── Privacy ────────────────────────────────────── */}
            <Section
              title="Privacy"
              description="Control who can find and interact with you"
            >
              <Row
                label="Private Account"
                hint={
                  isPrivate
                    ? 'Only followers can see your content. Strangers must send a follow request.'
                    : 'Anyone can follow you and share movies/parties with you.'
                }
                last
              >
                <Toggle
                  value={isPrivate}
                  onChange={handleTogglePrivacy}
                  disabled={savingPrivacy}
                />
              </Row>

              {/* Visual explanation */}
              <div style={{
                marginTop: '4px',
                background: isPrivate ? 'rgba(229,57,53,0.06)' : 'rgba(67,160,71,0.06)',
                border: `0.5px solid ${isPrivate ? 'rgba(229,57,53,0.2)' : 'rgba(67,160,71,0.2)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--text2)',
                lineHeight: 1.6,
              }}>
                {isPrivate ? (
                  <>
                    🔒 <strong>Private:</strong> Only approved followers see your profile, watch history,
                    and shared content. New users must send a follow request first.
                  </>
                ) : (
                  <>
                    🌐 <strong>Public:</strong> Anyone can follow you, share movies with you, and invite
                    you to watch parties. Shares from strangers go to your <em>Requests</em> tab.
                  </>
                )}
              </div>
            </Section>

            {/* ── Account Info (read-only email) ─────────────── */}
            <Section title="Account Info">
              <Row label="Email" hint="Contact support to change your email" last>
                <span style={{
                  fontSize: '13px', color: 'var(--text2)',
                  background: 'var(--bg2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                }}>
                  {user?.email}
                </span>
              </Row>
            </Section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            SECURITY TAB
        ════════════════════════════════════════════════════════ */}
        {tab === 'security' && (
          <>
            <Section
              title="Change Password"
              description="Use a strong password you don't use elsewhere"
            >
              {/* Current password */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.current}
                    onChange={setPw('current')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text3)', fontSize: '13px',
                    }}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {pwErrors.current && <div className="form-error">{pwErrors.current}</div>}
              </div>

              {/* New password */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.next}
                  onChange={setPw('next')}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                {pwErrors.next && <div className="form-error">{pwErrors.next}</div>}
                {/* Strength bar */}
                {pwForm.next && (() => {
                  const len      = pwForm.next.length;
                  const strength = len < 6 ? 1 : len < 10 ? 2 : len < 14 ? 3 : 4;
                  const colors   = ['', '#e53935', '#fb8c00', '#fdd835', '#43a047'];
                  const labels   = ['', 'Weak', 'Fair', 'Good', 'Strong'];
                  return (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, height: '3px', borderRadius: '2px',
                            background: i <= strength ? colors[strength] : 'var(--border)',
                            transition: 'background 0.2s',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: colors[strength] }}>
                        {labels[strength]}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Confirm */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Confirm New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={setPw('confirm')}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                {pwErrors.confirm && <div className="form-error">{pwErrors.confirm}</div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-red btn-sm"
                  onClick={handleChangePw}
                  disabled={savingPw}
                >
                  {savingPw ? 'Saving…' : 'Update Password'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate('/forgot-password')}
                  style={{ fontSize: '12px' }}
                >
                  Forgot current password?
                </button>
              </div>
            </Section>

            {/* Danger zone */}
            <Section title="Danger Zone">
              <Row label="Sign Out" hint="Signs you out on this device only">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleLogout}
                  style={{ borderColor: 'rgba(229,57,53,0.35)', color: 'var(--red)' }}
                >
                  🚪 Sign Out
                </button>
              </Row>
              <Row
                label="Sign Out Everywhere"
                hint="Revokes all sessions on all devices"
                last
              >
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleLogoutAll}
                  style={{ borderColor: 'rgba(229,57,53,0.35)', color: 'var(--red)' }}
                >
                  ⚠️ All Devices
                </button>
              </Row>
            </Section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            SESSIONS TAB
        ════════════════════════════════════════════════════════ */}
        {tab === 'sessions' && <SessionsTab onLogoutAll={handleLogoutAll} />}

      </div>
    </div>
  );
}

// ── Inline Sessions tab ────────────────────────────────────────────
function SessionsTab({ onLogoutAll }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [revoking, setRevoking] = useState(null);
  const loaded = useRef(false);

  React.useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    authService.getSessions()
      .then(data => setSessions(
        [...data].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      ))
      .catch(() => toast.error('Could not load sessions'))
      .finally(() => setLoading(false));
  }, []);

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

  const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const deviceIcon = (name = '') => {
    const d = name.toLowerCase();
    if (d.includes('iphone') || d.includes('android')) return '📱';
    if (d.includes('ipad'))  return '📟';
    return '💻';
  };

  return (
    <Section
      title="Active Sessions"
      description="Devices currently signed in to your account"
    >
      {loading ? (
        [1,2].map(n => (
          <div key={n} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 0',
            borderBottom: '0.5px solid var(--border)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: '50%', background: 'var(--bg2)', borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 10, width: '30%', background: 'var(--bg2)', borderRadius: 4 }} />
            </div>
          </div>
        ))
      ) : sessions.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: '13px', margin: 0 }}>No active sessions.</p>
      ) : (
        sessions.map((s, i) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 0',
            borderBottom: i < sessions.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{deviceIcon(s.deviceName)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {s.deviceName}
                {i === 0 && (
                  <span style={{
                    fontSize: '9.5px', fontWeight: 700,
                    background: 'var(--red)', color: '#fff',
                    padding: '1px 6px', borderRadius: '20px',
                  }}>
                    THIS DEVICE
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '2px' }}>
                Last active {timeAgo(s.lastUsed)} · Signed in {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>
            {i !== 0 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--red)', fontSize: '12px', flexShrink: 0 }}
                disabled={revoking === s.id}
                onClick={() => handleRevoke(s.id)}
              >
                {revoking === s.id ? '…' : 'Revoke'}
              </button>
            )}
          </div>
        ))
      )}

      {!loading && sessions.length > 1 && (
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--red)', fontSize: '12px' }}
            onClick={onLogoutAll}
          >
            Sign out from all devices
          </button>
        </div>
      )}
    </Section>
  );
}