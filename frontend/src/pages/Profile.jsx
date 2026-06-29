import React, {
  useEffect, useState, useCallback, useRef, memo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FollowButton from '../components/FollowButton';
import MovieCard from '../components/MovieCard';
import { followService } from '../services/followService';
import socket from '../sockets/socket';
import toast from 'react-hot-toast';
import userService from '../services/userService';

const AVATAR_COLORS = [
  '#b71c1c','#1a237e','#1b5e20',
  '#4a148c','#e65100','#006064',
];
const getColor = (u) =>
  AVATAR_COLORS[(u?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// ─────────────────────────────────────────────────────────────────────────────
// Profile Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Profile() {
  const { userId }   = useParams();
  const navigate     = useNavigate();
  const { user: me } = useAuth();

  const [profile,      setProfile]      = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [followStatus, setFollowStatus] = useState('none');
  const [followers,    setFollowers]    = useState([]);
  const [following,    setFollowing]    = useState([]);
  const [tab,          setTab]          = useState('history');
  const [loading,      setLoading]      = useState(true);

  const followStatusRef = useRef('none');
  useEffect(() => { followStatusRef.current = followStatus; }, [followStatus]);

  const isSelf = me?._id?.toString() === userId?.toString();
  const meId   = me?._id?.toString() ?? '';

  // ── FULL RESET + LOAD whenever userId changes ─────────────────
  useEffect(() => {
    setProfile(null);
    setWatchHistory([]);
    setFollowStatus('none');
    followStatusRef.current = 'none';
    setFollowers([]);
    setFollowing([]);
    setTab('history');
    setLoading(true);

    let cancelled = false;

    const load = async () => {
      try {
        const [prof, hist, statusRes] = await Promise.all([
          userService.getProfile(userId),
          userService.getWatchHistory(userId),
          isSelf ? Promise.resolve(null) : followService.getStatus(userId),
        ]);
        if (cancelled) return;
        setProfile(prof);
        setWatchHistory(hist || []);
        const s = statusRes?.status ?? 'none';
        setFollowStatus(s);
        followStatusRef.current = s;
      } catch {
        if (!cancelled) toast.error('Could not load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId, isSelf]);

  // ── SOCKET: real-time events ──────────────────────────────────
  const profileId = profile?._id?.toString() ?? '';

  useEffect(() => {
    if (!profileId || !meId) return;

    // Are both parties involved in this event relevant to the current page?
    const involves = (fromStr, targetStr) =>
      (fromStr === profileId || targetStr === profileId) &&
      (fromStr === meId      || targetStr === meId);

    // ── follow:request ──────────────────────────────────────────
    // Fires on RECIPIENT's socket room when someone sends them a follow/request.
    const onRequest = ({ fromUser, targetUser, status: s }) => {
      const from   = fromUser?._id?.toString();
      const target = targetUser?._id?.toString();
      if (!involves(from, target)) return;

      // ── Viewing someone else's page: they just followed/requested me ──
      if (from === profileId && target === meId && !isSelf) {
        if (s === 'pending') {
          setFollowStatus('accept');
          followStatusRef.current = 'accept';
        } else {
          const was  = followStatusRef.current;
          const next = was === 'following' ? 'mutual_follow' : 'follow_back';
          setFollowStatus(next);
          followStatusRef.current = next;
          setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
        }
        if (s === 'accepted') {
          setFollowers(prev => {
            if (prev.find(u => u._id?.toString() === from)) return prev;
            return [{ _id: from, username: fromUser.username, followersCount: 0 }, ...prev];
          });
        }
        return;
      }

      // ── Viewing MY OWN page: someone just followed/requested me ──
      // from = stranger, target = meId = profileId
      if (isSelf && target === meId) {
        if (s === 'accepted') {
          // Public follow: bump my follower count and add them to the list
          setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
          setFollowers(prev => {
            if (prev.find(u => u._id?.toString() === from)) return prev;
            return [{ _id: from, username: fromUser.username, followersCount: 0 }, ...prev];
          });
        }
        // For pending requests we don't change the count — they're not a follower yet.
      }
    };

    // ── follow:sent ─────────────────────────────────────────────
    // Arrives on MY socket room — I just followed/requested someone (other tab sync).
    const onSent = ({ fromUser, targetUser, status: s }) => {
      const from   = fromUser?._id?.toString();
      const target = targetUser?._id?.toString();
      if (from !== meId) return;

      // ── Viewing that person's profile ──
      if (target === profileId && !isSelf) {
        const next = s === 'accepted' ? 'following' : 'requested';
        setFollowStatus(next);
        followStatusRef.current = next;
        if (s === 'accepted') {
          setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
          setFollowers(prev => {
            if (prev.find(u => u._id?.toString() === meId)) return prev;
            return [{ _id: meId, username: me?.username, avatar: me?.avatar, followersCount: me?.followersCount || 0 }, ...prev];
          });
        }
        return;
      }

      // ── Viewing MY OWN page: I followed someone from another tab ──
      if (isSelf && s === 'accepted') {
        setProfile(p => p ? { ...p, followingCount: (p.followingCount || 0) + 1 } : p);
        // Add the person I just followed to my Following list if it's open
        setFollowing(prev => {
          if (prev.find(u => u._id?.toString() === target)) return prev;
          return [{ _id: target, username: targetUser?.username ?? '', followersCount: 0 }, ...prev];
        });
      }
    };

    // ── follow:accepted ─────────────────────────────────────────
    // Fired when a pending request is accepted.
    const onAccepted = ({ fromUser, targetUser }) => {
      const from   = fromUser?._id?.toString();  // who accepted (recipient of original request)
      const target = targetUser?._id?.toString(); // original requester

      // ── Viewing the acceptor's profile and they accepted MY request ──
      if (from === profileId && target === meId && !isSelf) {
        const was  = followStatusRef.current;
        const next = was === 'follow_back' ? 'mutual_follow' : 'following';
        setFollowStatus(next);
        followStatusRef.current = next;
        setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
        setFollowers(prev => {
          if (prev.find(u => u._id?.toString() === meId)) return prev;
          return [{ _id: meId, username: me?.username, avatar: me?.avatar, followersCount: me?.followersCount || 0 }, ...prev];
        });
        return;
      }

      // ── Viewing their profile and I accepted their request ──
      if (from === meId && target === profileId && !isSelf) {
        setFollowStatus('mutual_follow');
        followStatusRef.current = 'mutual_follow';
        setProfile(p => p ? { ...p, followingCount: (p.followingCount || 0) + 1 } : p);
        return;
      }

      // ── Viewing MY OWN page: someone accepted my request (I now follow them) ──
      if (isSelf && target === meId) {
        setProfile(p => p ? { ...p, followingCount: (p.followingCount || 0) + 1 } : p);
        setFollowing(prev => {
          if (prev.find(u => u._id?.toString() === from)) return prev;
          return [{ _id: from, username: fromUser?.username ?? '', followersCount: 0 }, ...prev];
        });
        return;
      }

      // ── Viewing MY OWN page: I accepted someone's request (they now follow me) ──
      if (isSelf && from === meId) {
        setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
        setFollowers(prev => {
          if (prev.find(u => u._id?.toString() === target)) return prev;
          return [{ _id: target, username: targetUser?.username ?? '', followersCount: 0 }, ...prev];
        });
      }
    };

    // ── follow:cancelled ────────────────────────────────────────
    const onCancelled = ({ fromUser, targetUser }) => {
      const from   = fromUser?._id?.toString();
      const target = targetUser?._id?.toString();
      if (!involves(from, target)) return;

      // Viewing other's page
      if (!isSelf) {
        setFollowStatus('none');
        followStatusRef.current = 'none';
        setFollowers(prev => prev.filter(u => u._id?.toString() !== from));
        return;
      }

      // Viewing my own page: someone cancelled their request to follow me
      if (isSelf && target === meId) {
        // No count change — pending requests don't affect followersCount
        setFollowers(prev => prev.filter(u => u._id?.toString() !== from));
      }
    };

    // ── follow:removed ───────────────────────────────────────────
    const onRemoved = ({ fromUser, targetUser }) => {
      const from   = fromUser?._id?.toString();
      const target = targetUser?._id?.toString();
      if (!involves(from, target)) return;

      // ── Viewing other's page: they unfollowed me ──
      if (from === profileId && target === meId && !isSelf) {
        const was  = followStatusRef.current;
        const next = was === 'mutual_follow' ? 'following' : 'none';
        setFollowStatus(next);
        followStatusRef.current = next;
        setProfile(p => p ? { ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) } : p);
        return;
      }

      // ── Viewing other's page: I unfollowed them (other-tab sync) ──
      if (from === meId && target === profileId && !isSelf) {
        const was  = followStatusRef.current;
        const next = was === 'mutual_follow' ? 'follow_back' : 'none';
        setFollowStatus(next);
        followStatusRef.current = next;
        setProfile(p => p ? { ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) } : p);
        setFollowers(prev => prev.filter(u => u._id?.toString() !== meId));
        return;
      }

      // ── Viewing MY OWN page: someone unfollowed me ──
      if (isSelf && target === meId) {
        setProfile(p => p ? { ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) } : p);
        setFollowers(prev => prev.filter(u => u._id?.toString() !== from));
        return;
      }

      // ── Viewing MY OWN page: I unfollowed someone (other-tab sync) ──
      if (isSelf && from === meId) {
        setProfile(p => p ? { ...p, followingCount: Math.max(0, (p.followingCount || 1) - 1) } : p);
        setFollowing(prev => prev.filter(u => u._id?.toString() !== target));
      }
    };

    // ── profile:updated ──────────────────────────────────────────
    // Emitted by user.service.js when any user updates their profile.
    // Works for self (editing in Settings) and others (viewing their page).
    const onProfileUpdated = ({ userId: updatedId, updates }) => {
      if (updatedId?.toString() !== profileId) return;
      setProfile(p => p ? { ...p, ...updates } : p);
    };

    socket.on('follow:request',    onRequest);
    socket.on('follow:sent',       onSent);
    socket.on('follow:accepted',   onAccepted);
    socket.on('follow:cancelled',  onCancelled);
    socket.on('follow:removed',    onRemoved);
    socket.on('profile:updated',   onProfileUpdated);

    return () => {
      socket.off('follow:request',    onRequest);
      socket.off('follow:sent',       onSent);
      socket.off('follow:accepted',   onAccepted);
      socket.off('follow:cancelled',  onCancelled);
      socket.off('follow:removed',    onRemoved);
      socket.off('profile:updated',   onProfileUpdated);
    };
  }, [profileId, meId, isSelf]);

  // ── Optimistic update from FollowButton ───────────────────────
  const handleFollowChange = useCallback((newStatus) => {
    const prev = followStatusRef.current;
    setFollowStatus(newStatus);
    followStatusRef.current = newStatus;

    const gained = ['following', 'mutual_follow'].includes(newStatus) &&
                   !['following', 'mutual_follow'].includes(prev);
    const lost   = ['none', 'follow_back', 'requested'].includes(newStatus) &&
                   ['following', 'mutual_follow'].includes(prev);

    if (gained) {
      setProfile(p => p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p);
    } else if (lost) {
      setProfile(p => p ? { ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) } : p);
    }
  }, []);

  // ── Lazy-load followers / following lists on tab click ─────────
  const handleTabChange = async (t) => {
    setTab(t);
    if (t === 'followers' && followers.length === 0) {
      const data = await followService.getFollowers(userId).catch(() => []);
      setFollowers(data);
    }
    if (t === 'following' && following.length === 0) {
      const data = await followService.getFollowing(userId).catch(() => []);
      setFollowing(data);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  if (!profile) {
    return (
      <div className="page">
        <div className="container">
          <p className="text-muted">User not found.</p>
        </div>
      </div>
    );
  }

  const initials   = profile?.username?.slice(0, 2)?.toUpperCase() || 'U';
  const color      = getColor(profile.username);
  const canMessage =
    !profile.isPrivate ||
    ['following', 'mutual_follow', 'follow_back'].includes(followStatus);

  return (
    <div className="page">
      <div className="container">

        {/* ── PROFILE HEADER ──────────────────────────────── */}
        <div className="profile-header">
          <div
            className="profile-avatar-lg"
            style={{ background: color, color: '#fff' }}
          >
            {profile.avatar
              ? <img src={profile.avatar} alt={profile.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          <div style={{ flex: 1 }}>
            <div className="profile-name">{profile.name || profile.username}</div>
            <div className="profile-username">@{profile.username.toLowerCase()}</div>

            {profile.bio && (
              <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '6px', maxWidth: '400px', lineHeight: 1.6 }}>
                {profile.bio}
              </p>
            )}

            {profile.isPrivate && (
              <span style={{
                fontSize: '11px', color: 'var(--text3)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '1px 6px', marginTop: '4px',
                display: 'inline-block',
              }}>
                🔒 Private
              </span>
            )}

            {/* Stats */}
            <div className="profile-stats">
              <div style={{ cursor: 'pointer' }} onClick={() => handleTabChange('followers')}>
                <div className="profile-stat-val">{profile.followersCount ?? 0}</div>
                <div className="profile-stat-label">Followers</div>
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => handleTabChange('following')}>
                <div className="profile-stat-val">{profile.followingCount ?? 0}</div>
                <div className="profile-stat-label">Following</div>
              </div>
              <div>
                <div className="profile-stat-val">{watchHistory.length}</div>
                <div className="profile-stat-label">Watched</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {!isSelf && (
                <FollowButton
                  targetUserId={profile._id}
                  targetUsername={profile.username}
                  initialStatus={followStatus}
                  onStatusChange={handleFollowChange}
                />
              )}
              {!isSelf && profile && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/messages?new=${profile._id}`)}
                  disabled={!canMessage}
                  style={{ opacity: canMessage ? 1 : 0.45, cursor: canMessage ? 'pointer' : 'not-allowed' }}
                >
                  {canMessage ? '💬 Message' : '🔒 Message'}
                </button>
              )}
              {isSelf && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
                  ✏️ Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* ── TABS ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { key: 'history',   label: '🎬 Watched'    },
            { key: 'parties',   label: '🎉 Parties'    },
            { key: 'followers', label: `👥 Followers (${profile.followersCount ?? 0})`  },
            { key: 'following', label: `➡️ Following (${profile.followingCount ?? 0})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`btn btn-sm ${tab === key ? 'btn-red' : 'btn-ghost'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ─────────────────────────────────── */}

        {tab === 'history' && (
          watchHistory.length === 0
            ? <p className="text-muted">No watch history yet.</p>
            : (
              <div className="movie-grid">
                {watchHistory.map(item => (
                  <MovieCard key={item.movie._id} movie={item.movie} />
                ))}
              </div>
            )
        )}

        {tab === 'parties' && (
          !profile.watchParties?.length
            ? <p className="text-muted">No watch parties yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {profile.watchParties.map(party => (
                  <div key={party._id} className="card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{party.movieTitle}</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '2px' }}>
                        {new Date(party.createdAt).toLocaleDateString()} · {party.participantCount} viewers
                      </div>
                    </div>
                    {party.active && (
                      <button className="btn btn-red btn-sm" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/party/${party._id}`)}>
                        Rejoin
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
        )}

        {tab === 'followers' && (
          followers.length === 0
            ? <p className="text-muted">No followers yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {followers.map(u => <UserRow key={u._id} user={u} navigate={navigate} meId={meId} />)}
              </div>
            )
        )}

        {tab === 'following' && (
          following.length === 0
            ? <p className="text-muted">Not following anyone yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {following.map(u => <UserRow key={u._id} user={u} navigate={navigate} meId={meId} />)}
              </div>
            )
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserRow
// ─────────────────────────────────────────────────────────────────────────────
const UserRow = memo(function UserRow({ user, navigate, meId }) {
  const color    = getColor(user.username);
  const initials = user.username?.slice(0, 2).toUpperCase();
  const isMe     = user._id?.toString() === meId;

  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (isMe) { setStatus('self'); return; }
    let cancelled = false;
    followService.getStatus(user._id)
      .then(res => { if (!cancelled) setStatus(res.status); })
      .catch(() => { if (!cancelled) setStatus('none'); });
    return () => { cancelled = true; };
  }, [user._id, isMe]);

  return (
    <div
      className="card"
      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onClick={() => navigate(`/profile/${user._id}`)}
    >
      {user.avatar
        ? <img src={user.avatar} alt={user.username} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : (
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
            {initials}
          </div>
        )
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '14px' }}>{user.username}</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>{user.followersCount ?? 0} followers</div>
      </div>

      {!isMe && status !== 'loading' && status !== 'self' && (
        <div onClick={e => e.stopPropagation()}>
          <FollowButton targetUserId={user._id} targetUsername={user.username} initialStatus={status} onStatusChange={setStatus} size="sm" />
        </div>
      )}

      {status === 'loading' && (
        <div style={{ width: 70, height: 30, borderRadius: '6px', background: 'var(--surface)', flexShrink: 0, animation: 'pulse 1.2s infinite' }} />
      )}
    </div>
  );
});