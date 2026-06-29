import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import movieService from '../services/movieService';
import conversationService from '../services/conversationService';
import followService from '../services/followService';
import shareService from '../services/shareService';
import toast from 'react-hot-toast';
import { getAvatarColor } from '../utils/avatar';
import { useSearch } from '../hooks/useSearch';
import { getContactMode, canContact, lockedToast, requestHint } from '../utils/canContact';

export default function ShareMovie() {
  const { movieId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [movie,     setMovie]     = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [selected,  setSelected]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);

  const [tab,         setTab]         = useState('mutual');
  const [localSearch, setLocalSearch] = useState('');
  const userSearch = useSearch({ users: true, movies: false, parties: false, debounce: 250 });
  const [searchCache, setSearchCache] = useState({});

  useEffect(() => {
    if (!user?._id) return;
    Promise.all([
      movieService.getById(movieId),
      followService.getFollowers(user._id),
      followService.getFollowing(user._id),
    ]).then(([m, frs, fing]) => {
      setMovie(m);
      setFollowers(frs  || []);
      setFollowing(fing || []);
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [movieId, user?._id]);

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
    if (tab === 'search') {
      return userSearch.results.users.filter(u => u._id !== user?._id);
    }
    const base = { mutual: mutualFriends, followers: followersOnly, following: followingOnly }[tab] || [];
    if (!localSearch.trim()) return base;
    return base.filter(u => u.username?.toLowerCase().includes(localSearch.toLowerCase()));
  }, [tab, mutualFriends, followersOnly, followingOnly, localSearch, userSearch.results.users, user?._id]);

  // Count locked users in search results for the hint banner
  const lockedCount = useMemo(() => {
    if (tab !== 'search') return 0;
    return userSearch.results.users.filter(u =>
      u._id !== user?._id && getContactMode(u) === 'locked'
    ).length;
  }, [tab, userSearch.results.users, user?._id]);

  const toggle = (person) => {
    if (getContactMode(person) === 'locked') {
      toast.error(lockedToast(person.username));
      return;
    }
    const id = person._id;
    if (!searchCache[id]) setSearchCache(prev => ({ ...prev, [id]: person }));
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    // Only select selectable (non-locked) users
    const ids = activeList.filter(u => canContact(u)).map(u => u._id);
    const allSel = ids.every(id => selected.includes(id));
    if (allSel) {
      setSelected(prev => prev.filter(id => !ids.includes(id)));
    } else {
      activeList.forEach(u => { if (!searchCache[u._id]) setSearchCache(p => ({ ...p, [u._id]: u })); });
      setSelected(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const resolveUser = (id) =>
    allKnown.find(u => u._id === id) ||
    searchCache[id] ||
    userSearch.results.users.find(u => u._id === id);

  const handleSend = async () => {
    if (!selected.length) { toast.error('Select at least one person'); return; }
    setSending(true);
    try {
      if (selected.length === 1) {
        const conv = await conversationService.createConversation(selected);
        await conversationService.sendMessage(conv._id, { type: 'movie', movieId, movieTitle: movie.title });
        await shareService.shareMovie(movieId, selected);
        toast.success('Movie shared!');
        navigate(`/messages/${conv._id}`);
      } else {
        await Promise.all(selected.map(async (recipientId) => {
          const conv = await conversationService.createConversation([recipientId]);
          await conversationService.sendMessage(conv._id, { type: 'movie', movieId, movieTitle: movie.title });
        }));
        await shareService.shareMovie(movieId, selected);
        toast.success(`Shared with ${selected.length} people!`);
        navigate('/messages');
      }
    } catch {
      toast.error('Share failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const tabCounts = { mutual: mutualFriends.length, followers: followersOnly.length, following: followingOnly.length };
  const selectableList = activeList.filter(u => canContact(u));
  const allFilteredSelected = selectableList.length > 0 && selectableList.every(u => selected.includes(u._id));
  const isLocalTab     = tab !== 'search';
  const searchValue    = isLocalTab ? localSearch : userSearch.query;
  const setSearchValue = isLocalTab ? setLocalSearch : userSearch.setQuery;
  const clearSearch    = () => { setLocalSearch(''); userSearch.clear(); };

  // Count how many selected are request-mode (show hint)
  const requestCount = selected.filter(id => {
    const p = resolveUser(id);
    return p && getContactMode(p) === 'request';
  }).length;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '680px' }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-eyebrow">Share Movie</div>
          <div className="section-title">Send to Friends</div>
        </div>

        {/* Movie preview */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 70, height: 100, borderRadius: '10px', background: movie.color || '#1a237e', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
            {movie.thumbnail && <img src={movie.thumbnail} alt={movie.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{movie.title}</div>
            <div style={{ color: 'var(--text2)', fontSize: '13px' }}>{movie.genre} · {movie.year}</div>
            {movie.description && (
              <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {movie.description}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { key: 'mutual',    label: '🤝 Friends',     count: tabCounts.mutual    },
            { key: 'followers', label: '👥 Followers',   count: tabCounts.followers },
            { key: 'following', label: '➡️ Following',  count: tabCounts.following },
            { key: 'search',    label: '🔍 Find Anyone', count: null                },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setLocalSearch(''); userSearch.clear(); }}
              className={`btn btn-sm ${tab === key ? 'btn-red' : 'btn-ghost'}`}
            >
              {label}
              {count != null && count > 0 && (
                <span style={{ background: tab === key ? 'rgba(255,255,255,0.25)' : 'var(--surface2)', borderRadius: '99px', padding: '0 6px', fontSize: '11px', marginLeft: '2px' }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '14px', pointerEvents: 'none' }}>
            {tab === 'search' && userSearch.loading ? '⏳' : '🔍'}
          </span>
          <input
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder={tab === 'search' ? 'Search all users…' : 'Filter your connections…'}
            style={{ paddingLeft: '40px', paddingRight: searchValue ? '36px' : '14px' }}
          />
          {searchValue && (
            <button onClick={clearSearch} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', fontSize: '16px', cursor: 'pointer' }}>×</button>
          )}
        </div>

        {/* Locked accounts hint */}
        {tab === 'search' && !userSearch.loading && lockedCount > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            🔒 {lockedCount} private account{lockedCount !== 1 ? 's' : ''} — follow them to share.
          </div>
        )}

        {/* Request mode hint */}
        {requestCount > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px', padding: '8px 12px', background: 'rgba(229,57,53,0.06)', border: '0.5px solid rgba(229,57,53,0.2)', borderRadius: 'var(--radius-sm)' }}>
            📨 {requestCount} person{requestCount !== 1 ? 's' : ''} will receive a share request they can accept or decline.
          </div>
        )}

        {/* Select all */}
        {selectableList.length > 0 && !userSearch.loading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {selected.length > 0 ? `${selected.length} selected` : `${selectableList.length} available`}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={toggleAll} style={{ fontSize: '12px' }}>
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {/* User list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>

          {tab === 'search' && userSearch.loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          )}

          {!userSearch.loading && activeList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text3)', fontSize: '13px' }}>
              {tab === 'search'
                ? userSearch.isSearching ? `No users found for "${userSearch.query}"` : 'Type a name to search all users'
                : localSearch ? `No results for "${localSearch}"`
                : tab === 'mutual'    ? 'You have no mutual follows yet.'
                : tab === 'followers' ? 'Nobody follows you yet.'
                :                      "You're not following anyone yet."}
            </div>
          )}

          {!userSearch.loading && activeList.map(person => {
            const isSelected  = selected.includes(person._id);
            const mode        = getContactMode(person);
            const isLocked    = mode === 'locked';
            const isRequest   = mode === 'request';
            const color       = getAvatarColor(person.username);
            const isMutual    = followerIds.has(person._id?.toString()) && followingIds.has(person._id?.toString());
            const isFollower  = followerIds.has(person._id?.toString());
            const relationLabel = tab === 'search'
              ? isLocked   ? '🔒 Private account'
              : isRequest  ? '🌐 Public · Share goes as request'
              : isMutual   ? '🤝 Friends'
              : isFollower ? 'Follows you'
              : 'You follow'
              : isMutual   ? '🤝 Friends'
              : isFollower ? 'Follows you'
              : 'You follow';

            return (
              <div
                key={person._id}
                onClick={() => toggle(person)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: isLocked ? 'var(--bg2)' : isSelected ? 'rgba(229,57,53,0.10)' : 'var(--bg3)',
                  border: `${isSelected ? '1px' : '0.5px'} solid ${isSelected ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: '14px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                  transition: 'all 0.18s ease', userSelect: 'none',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
                  {person.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{person.username}</div>
                  <div style={{ fontSize: '11.5px', color: isLocked ? 'var(--text3)' : isRequest ? 'var(--red)' : 'var(--text3)', marginTop: '1px' }}>
                    {relationLabel}
                    {!isLocked && person.followersCount != null && <span style={{ marginLeft: '6px', color: 'var(--text3)' }}>· {person.followersCount.toLocaleString()} followers</span>}
                  </div>
                </div>
                {isLocked ? (
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>🔒</span>
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? 'var(--red)' : 'var(--border2)'}`, background: isSelected ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff', transition: 'all 0.18s ease' }}>
                    {isSelected && '✓'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected pills */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem', padding: '10px 12px', background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)', alignSelf: 'center' }}>To:</span>
            {selected.map(id => {
              const person = resolveUser(id);
              if (!person) return null;
              return (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(229,57,53,0.12)', border: '0.5px solid rgba(229,57,53,0.35)', borderRadius: '99px', padding: '3px 10px', fontSize: '12px', color: 'var(--text)' }}>
                  {person.username}
                  {getContactMode(person) === 'request' && <span style={{ fontSize: '9px', color: 'var(--red)' }}> req</span>}
                  <span onClick={(e) => { e.stopPropagation(); toggle(person); }} style={{ cursor: 'pointer', color: 'var(--text3)', marginLeft: '2px' }}>×</span>
                </span>
              );
            })}
          </div>
        )}

        <button
          className="btn btn-red btn-lg"
          onClick={handleSend}
          disabled={sending || selected.length === 0}
          style={{ width: '100%' }}
        >
          {sending ? 'Sending…'
            : selected.length === 0 ? 'Select someone to share with'
            : `Send to ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`}
        </button>

        {selected.length > 1 && (
          <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginTop: '10px' }}>
            Each person receives their own message. Request recipients can accept or decline.
          </p>
        )}
      </div>
    </div>
  );
}