import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import movieService from '../services/movieService';
import { followService } from '../services/followService';
import shareService from '../services/shareService';
import conversationService from '../services/conversationService';
import toast from 'react-hot-toast';
import { useSearch } from '../hooks/useSearch';
import { getContactMode, canContact, lockedToast } from '../utils/canContact';

const AVATAR_COLORS = ['#b71c1c','#1a237e','#1b5e20','#4a148c','#e65100','#006064','#880e4f'];
const avatarColor = (username) => AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function Step({ n, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: done ? '#4caf50' : active ? 'var(--red)' : 'var(--bg3)', border: `1.5px solid ${done ? '#4caf50' : active ? 'var(--red)' : 'var(--border2)'}`, color: done || active ? '#fff' : 'var(--text3)', transition: 'all 0.25s' }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? 'var(--text)' : done ? 'var(--text2)' : 'var(--text3)', transition: 'color 0.25s' }}>
        {label}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: '99px', background: checked ? 'var(--red)' : 'var(--bg2)', border: `1.5px solid ${checked ? 'var(--red)' : 'var(--border2)'}`, position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 22 : 2, transition: 'left 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

export default function CreateParty() {
  const { movieId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [step, setStep] = useState(1);
  const [movie,   setMovie]   = useState(null);
  const [loading, setLoading] = useState(true);

  const [roomName,   setRoomName]   = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [isLocked,   setIsLocked]   = useState(false);
  const [maxViewers, setMaxViewers] = useState(50);

  const [followers,     setFollowers]     = useState([]);
  const [following,     setFollowing]     = useState([]);
  const [invited,       setInvited]       = useState([]);
  const [inviteTab,     setInviteTab]     = useState('mutual');
  const [localSearch,   setLocalSearch]   = useState('');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [searchCache,   setSearchCache]   = useState({});
  const [creating,      setCreating]      = useState(false);

  const userSearch = useSearch({ users: true, movies: false, parties: false, debounce: 250 });

  useEffect(() => {
    movieService.getById(movieId)
      .then(setMovie)
      .catch(() => { toast.error('Movie not found'); navigate(-1); })
      .finally(() => setLoading(false));
  }, [movieId, navigate]);

  useEffect(() => {
    if (step !== 2 || followers.length > 0 || !user?._id) return;
    setPeopleLoading(true);
    Promise.all([followService.getFollowers(user._id), followService.getFollowing(user._id)])
      .then(([frs, fing]) => { setFollowers(frs || []); setFollowing(fing || []); })
      .catch(() => toast.error('Could not load followers'))
      .finally(() => setPeopleLoading(false));
  }, [step, user?._id, followers.length]);

  const followerIds  = useMemo(() => new Set(followers.map(u => u._id?.toString())), [followers]);
  const followingIds = useMemo(() => new Set(following.map(u => u._id?.toString())), [following]);

  const mutualFriends = useMemo(() => following.filter(u => followerIds.has(u._id?.toString())),  [following, followerIds]);
  const followersOnly = useMemo(() => followers.filter(u => !followingIds.has(u._id?.toString())), [followers, followingIds]);
  const followingOnly = useMemo(() => following.filter(u => !followerIds.has(u._id?.toString())),  [following, followerIds]);

  const allKnown = useMemo(() => {
    const seen = new Set();
    return [...mutualFriends, ...followersOnly, ...followingOnly].filter(u => {
      const k = u._id?.toString();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }, [mutualFriends, followersOnly, followingOnly]);

  // Show ALL users — locked ones visible but not selectable
  const activeList = useMemo(() => {
    if (inviteTab === 'search') {
      return userSearch.results.users.filter(u => u._id !== user?._id);
    }
    const base = { mutual: mutualFriends, followers: followersOnly, following: followingOnly }[inviteTab] || [];
    if (!localSearch.trim()) return base;
    return base.filter(u => u.username?.toLowerCase().includes(localSearch.toLowerCase()));
  }, [inviteTab, mutualFriends, followersOnly, followingOnly, localSearch, userSearch.results.users, user?._id]);

  const lockedCount = useMemo(() => {
    if (inviteTab !== 'search') return 0;
    return userSearch.results.users.filter(u =>
      u._id !== user?._id && getContactMode(u) === 'locked'
    ).length;
  }, [inviteTab, userSearch.results.users, user?._id]);

  const requestCount = useMemo(() =>
    invited.filter(id => {
      const p = allKnown.find(u => u._id === id) || searchCache[id];
      return p && getContactMode(p) === 'request';
    }).length,
  [invited, allKnown, searchCache]);

  const relationLabel = (u) => {
    const mode   = getContactMode(u);
    const isMut  = followerIds.has(u._id?.toString()) && followingIds.has(u._id?.toString());
    if (mode === 'locked')   return '🔒 Private account';
    if (mode === 'request')  return '🌐 Public · Invite goes as request';
    if (isMut)               return '🤝 Friends';
    if (followerIds.has(u._id?.toString())) return 'Follows you';
    return 'You follow';
  };

  const toggleInvite = (person) => {
    if (getContactMode(person) === 'locked') {
      toast.error(lockedToast(person.username));
      return;
    }
    const id = typeof person === 'string' ? person : person._id;
    if (typeof person === 'object' && !searchCache[id]) {
      setSearchCache(prev => ({ ...prev, [id]: person }));
    }
    setInvited(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const resolveInvited = (id) =>
    allKnown.find(u => u._id === id) ||
    searchCache[id] ||
    userSearch.results.users.find(u => u._id === id);

  const isLocalTab     = inviteTab !== 'search';
  const searchValue    = isLocalTab ? localSearch : userSearch.query;
  const setSearchValue = isLocalTab ? setLocalSearch : userSearch.setQuery;
  const clearSearch    = () => { setLocalSearch(''); userSearch.clear(); };

  const handleCreate = async () => {
    setCreating(true);
    setStep(3);
    try {
      const room = await movieService.createParty(movieId, {
        name: roomName.trim() || movie.title,
        isPrivate, isLocked, maxViewers,
      });
      if (invited.length > 0) {
        await shareService.shareParty(room._id, invited);
        if (invited.length === 1) {
          const conv = await conversationService.createConversation(invited);
          await conversationService.sendMessage(conv._id, { type: 'party', roomId: room._id, movieTitle: movie.title });
        } else {
          await Promise.all(invited.map(async (recipientId) => {
            const conv = await conversationService.createConversation([recipientId]);
            await conversationService.sendMessage(conv._id, { type: 'party', roomId: room._id, movieTitle: movie.title });
          }));
        }
      }
      toast.success('Watch party created!');
      navigate(`/party/${room._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create party');
      setStep(2);
      setCreating(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '660px' }}>

        <div style={{ marginBottom: '2rem' }}>
          <div className="section-eyebrow">Watch Together</div>
          <div className="section-title">Create Watch Party</div>
        </div>

        {/* Step tracker */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px' }}>
          <Step n={1} label="Room Setup" active={step === 1} done={step > 1} />
          <div style={{ flex: 1, height: '1px', background: step > 1 ? 'var(--red)' : 'var(--border)', margin: '0 12px', transition: 'background 0.4s' }} />
          <Step n={2} label="Invite"     active={step === 2} done={step > 2} />
          <div style={{ flex: 1, height: '1px', background: step > 2 ? 'var(--red)' : 'var(--border)', margin: '0 12px', transition: 'background 0.4s' }} />
          <Step n={3} label="Launch"     active={step === 3} done={false} />
        </div>

        {/* Movie preview */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '1.8rem' }}>
          <div style={{ width: 56, height: 80, borderRadius: '8px', background: movie?.color || '#1a237e', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
            {movie?.thumbnail && <img src={movie.thumbnail} alt={movie.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{movie?.title}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '3px' }}>{movie?.genre} · {movie?.year}</div>
            {movie?.duration && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>🕐 {Math.floor(movie.duration / 60)}h {movie.duration % 60}m</div>}
          </div>
          <div style={{ marginLeft: 'auto' }}><span className="badge badge-red">🎉 Party</span></div>
        </div>

        {/* ── STEP 1 ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="form-group">
              <label className="form-label">Room Name (optional)</label>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder={`${user?.username}'s Watch Party`} maxLength={60} />
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Leave blank to use the movie title</div>
            </div>
            <div>
              <label className="form-label">Room Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                {[
                  { key: false, icon: '🌐', title: 'Public',  desc: 'Anyone can find and join from the Discover page.' },
                  { key: true,  icon: '🔒', title: 'Private', desc: 'Only people you invite can join via the party link.' },
                ].map(opt => (
                  <div key={String(opt.key)} onClick={() => setIsPrivate(opt.key)} style={{ padding: '14px', background: isPrivate === opt.key ? 'rgba(229,57,53,0.09)' : 'var(--bg3)', border: `${isPrivate === opt.key ? '1px' : '0.5px'} solid ${isPrivate === opt.key ? 'var(--red)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.18s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '4px' }}>{opt.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '13.5px' }}>🔐 Lock Room After Start</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>Prevent new people from joining once playback begins.</div>
              </div>
              <Toggle checked={isLocked} onChange={setIsLocked} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max Viewers <span style={{ color: 'var(--red)', marginLeft: '8px', fontWeight: 600 }}>{maxViewers}</span></label>
              <input type="range" min={2} max={100} step={1} value={maxViewers} onChange={e => setMaxViewers(Number(e.target.value))} style={{ width: '100%', marginTop: '8px', accentColor: 'var(--red)', cursor: 'pointer', height: '6px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                <span>2</span><span>50</span><span>100</span>
              </div>
            </div>
            <div style={{ background: 'rgba(229,57,53,0.06)', border: '0.5px solid rgba(229,57,53,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>
              📺 <strong style={{ color: 'var(--text)' }}>HD video</strong> shared for up to 9 cameras. Others join audio-only automatically.
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-red" onClick={() => setStep(2)} disabled={!movie} style={{ flex: 2 }}>Next: Invite Friends →</button>
            </div>
          </div>
        )}

        {/* ── STEP 2 — Invite ─────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>Invite People</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>They'll get a notification and can join before you start.</div>
              </div>
              {invited.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setInvited([])} style={{ fontSize: '12px' }}>Clear all</button>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'mutual',    label: '🤝 Friends',     count: mutualFriends.length },
                { key: 'followers', label: '👥 Followers',   count: followersOnly.length },
                { key: 'following', label: '➡️ Following',  count: followingOnly.length },
                { key: 'search',    label: '🔍 Find Anyone', count: null                 },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => { setInviteTab(key); setLocalSearch(''); userSearch.clear(); }} className={`btn btn-sm ${inviteTab === key ? 'btn-red' : 'btn-ghost'}`}>
                  {label}
                  {count != null && count > 0 && (
                    <span style={{ background: inviteTab === key ? 'rgba(255,255,255,0.22)' : 'var(--surface2)', borderRadius: '99px', padding: '0 6px', fontSize: '11px', marginLeft: '2px' }}>{count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '14px', pointerEvents: 'none' }}>
                {inviteTab === 'search' && userSearch.loading ? '⏳' : '🔍'}
              </span>
              <input value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder={inviteTab === 'search' ? 'Search all users…' : 'Search followers or following…'} style={{ paddingLeft: '40px', paddingRight: searchValue ? '36px' : '14px' }} />
              {searchValue && <button onClick={clearSearch} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer' }}>×</button>}
            </div>

            {/* Locked hint */}
            {inviteTab === 'search' && !userSearch.loading && lockedCount > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                🔒 {lockedCount} private account{lockedCount !== 1 ? 's' : ''} — follow them to invite.
              </div>
            )}

            {/* Request hint */}
            {requestCount > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text2)', padding: '8px 12px', background: 'rgba(229,57,53,0.06)', border: '0.5px solid rgba(229,57,53,0.2)', borderRadius: 'var(--radius-sm)' }}>
                📨 {requestCount} invite{requestCount !== 1 ? 's' : ''} will go as requests they can accept or decline.
              </div>
            )}

            {/* List */}
            {(peopleLoading || (inviteTab === 'search' && userSearch.loading)) ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : activeList.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
                {inviteTab === 'search'
                  ? userSearch.isSearching ? `No users found for "${userSearch.query}"` : 'Type a name to search all users'
                  : localSearch ? `No results for "${localSearch}"`
                  : inviteTab === 'mutual'    ? "No mutual follows yet."
                  : inviteTab === 'followers' ? "Nobody follows you yet."
                  :                            "You're not following anyone yet."}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {activeList.map(person => {
                  const isInvited = invited.includes(person._id);
                  const mode      = getContactMode(person);
                  const isLocked  = mode === 'locked';
                  const isRequest = mode === 'request';
                  const color     = avatarColor(person.username);
                  return (
                    <div key={person._id} onClick={() => toggleInvite(person)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: isLocked ? 'var(--bg2)' : isInvited ? 'rgba(229,57,53,0.09)' : 'var(--bg3)', border: `${isInvited ? '1px' : '0.5px'} solid ${isInvited ? 'var(--red)' : 'var(--border)'}`, borderRadius: '12px', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.6 : 1, transition: 'all 0.18s ease', userSelect: 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
                        {person.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{person.username}</div>
                        <div style={{ fontSize: '11.5px', color: isLocked ? 'var(--text3)' : isRequest ? 'var(--red)' : 'var(--text3)', marginTop: '1px' }}>
                          {relationLabel(person)}
                          {!isLocked && person.followersCount != null && <span style={{ marginLeft: '6px', color: 'var(--text3)' }}>· {person.followersCount.toLocaleString()} followers</span>}
                        </div>
                      </div>
                      {isLocked ? (
                        <span style={{ fontSize: '15px' }}>🔒</span>
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isInvited ? 'var(--red)' : 'var(--border2)'}`, background: isInvited ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', transition: 'all 0.18s ease' }}>
                          {isInvited && '✓'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invited pills */}
            {invited.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text3)', alignSelf: 'center' }}>Inviting:</span>
                {invited.map(id => {
                  const p = resolveInvited(id);
                  if (!p) return null;
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(229,57,53,0.12)', border: '0.5px solid rgba(229,57,53,0.35)', borderRadius: '99px', padding: '3px 10px', fontSize: '12px', color: 'var(--text)' }}>
                      {p.username}
                      {getContactMode(p) === 'request' && <span style={{ fontSize: '9px', color: 'var(--red)' }}> req</span>}
                      <span onClick={() => toggleInvite(p)} style={{ cursor: 'pointer', color: 'var(--text3)', marginLeft: '2px', fontSize: '14px' }}>×</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-red" onClick={handleCreate} style={{ flex: 2 }}>
                {invited.length > 0 ? `🎉 Launch & Invite ${invited.length} ${invited.length === 1 ? 'Person' : 'People'}` : '🎉 Launch Party'}
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginTop: '-4px' }}>
              You can also share the invite link after the room is created.
            </p>
          </div>
        )}

        {/* ── STEP 3 ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '3rem 1rem', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', animation: 'pulse 1.2s infinite' }}>🎉</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '17px', marginBottom: '8px' }}>{creating ? 'Creating your party…' : 'Party created!'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                {invited.length > 0 ? `Sending invites to ${invited.length} ${invited.length === 1 ? 'person' : 'people'}…` : 'Setting up your room…'}
              </div>
            </div>
            <div className="spinner" />
          </div>
        )}

      </div>
    </div>
  );
}