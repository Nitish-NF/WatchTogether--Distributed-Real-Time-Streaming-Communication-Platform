import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import shareService from '../services/shareService';
import socket from '../sockets/socket';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { getAvatarColor } from '../utils/avatar';
import { formatStreamUrl } from '../utils/media';

export default function FeedPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [feed,     setFeed]     = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('all'); // 'all' | 'movies' | 'parties' | 'requests'

  // ── Load feed + requests ─────────────────────────────────────────
  const loadAll = useCallback(() => {
    Promise.all([
      shareService.getFeed(),
      shareService.getRequests(),   // NEW — public stranger requests
    ])
      .then(([feedData, reqData]) => {
        setFeed(feedData    || []);
        setRequests(reqData || []);
      })
      .catch(() => toast.error('Could not load feed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();

    // Real-time: refresh when new share/invite arrives
    const onPartyInvite = ({ isRequest }) => {
      loadAll();
      toast.success(isRequest ? 'New party invite request!' : 'New party invite!');
    };
    const onMovieShare = ({ isRequest }) => {
      loadAll();
      toast.success(isRequest ? 'New movie share request!' : 'New movie shared with you!');
    };

    socket.on('party_invite', onPartyInvite);
    socket.on('movie_share',  onMovieShare);
    return () => {
      socket.off('party_invite', onPartyInvite);
      socket.off('movie_share',  onMovieShare);
    };
  }, [loadAll]);

  // ── Accept / decline a request ───────────────────────────────────
  const handleAccept = async (shareId) => {
    try {
      await shareService.acceptRequest(shareId);
      // Move from requests to feed
      const accepted = requests.find(r => r._id === shareId);
      if (accepted) {
        setRequests(prev => prev.filter(r => r._id !== shareId));
        setFeed(prev => [{ ...accepted, isRequest: false }, ...prev]);
      }
      toast.success('Request accepted!');
    } catch {
      toast.error('Could not accept request');
    }
  };

  const handleDecline = async (shareId) => {
    try {
      await shareService.declineRequest(shareId);
      setRequests(prev => prev.filter(r => r._id !== shareId));
      toast.success('Request declined');
    } catch {
      toast.error('Could not decline request');
    }
  };

  // ── Filter feed by tab ───────────────────────────────────────────
  const filtered = tab === 'requests'
    ? requests
    : feed.filter(item => {
        if (tab === 'movies')  return item.type === 'movie';
        if (tab === 'parties') return item.type === 'party';
        return true;
      });

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '680px' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-eyebrow">Social</div>
          <div className="section-title">Your Feed</div>
          <p style={{ fontSize: '13.5px', color: 'var(--text2)', marginTop: '6px' }}>
            Movies and parties shared with you.
          </p>
        </div>

        {/* Tabs — CHANGED: added Requests tab with count badge */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',      label: '🌐 All'     },
            { key: 'movies',   label: '🎬 Movies'  },
            { key: 'parties',  label: '🎉 Parties' },
            { key: 'requests', label: '📨 Requests', count: requests.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`btn btn-sm ${tab === key ? 'btn-red' : 'btn-ghost'}`}
            >
              {label}
              {count > 0 && (
                <span style={{
                  background: tab === key ? 'rgba(255,255,255,0.25)' : 'var(--red)',
                  color: '#fff',
                  borderRadius: '99px', padding: '0 6px',
                  fontSize: '10px', marginLeft: '4px', fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feed list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text3)', fontSize: '14px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
              {tab === 'requests' ? '📨' : tab === 'parties' ? '🎉' : '🎬'}
            </div>
            <div style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: '6px' }}>
              {tab === 'requests' ? 'No pending requests' : 'Nothing here yet'}
            </div>
            {tab === 'requests'
              ? 'Share requests from new people will appear here.'
              : 'Follow people to see their shared movies and party invites.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(item => (
              <FeedItem
                key={item._id}
                item={item}
                navigate={navigate}
                isRequest={tab === 'requests'}
                onAccept={() => handleAccept(item._id)}
                onDecline={() => handleDecline(item._id)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Individual feed item ──────────────────────────────────────────────────────
function FeedItem({ item, navigate, isRequest, onAccept, onDecline }) {
  const isMovie = item.type === 'movie';
  const isParty = item.type === 'party';
  const sender  = item.fromUser;
  const color   = getAvatarColor(sender?.username);

  if (isMovie && item.movieId?.thumbnail) {
    item.movieId.thumbnail = formatStreamUrl(item.movieId.thumbnail);
  }

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        cursor: 'pointer',
        // CHANGED: request items have a subtle border tint
        borderColor: isRequest ? 'rgba(229,57,53,0.3)' : undefined,
      }}
      onClick={() => {
        if (isMovie && item.movieId?._id) navigate(`/movie/${item.movieId._id}`);
        if (isParty && item.roomId)       navigate(`/party/${item.roomId}`);
      }}
    >
      {/* Sender avatar */}
      <div
        style={{ width: 40, height: 40, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', flexShrink: 0, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); navigate(`/profile/${sender?._id}`); }}
      >
        {sender?.username?.slice(0, 2).toUpperCase() || '??'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Text */}
        <div style={{ fontSize: '13.5px', lineHeight: 1.5, marginBottom: '8px' }}>
          <strong
            style={{ color: 'var(--text)', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); navigate(`/profile/${sender?._id}`); }}
          >
            {sender?.username || 'Someone'}
          </strong>
          {/* CHANGED: different wording for requests */}
          {isMovie && <> {isRequest ? 'wants to share a movie with you' : 'shared a movie with you'}</>}
          {isParty && <> {isRequest ? 'wants to invite you to a watch party' : 'invited you to a watch party'}</>}
          <span style={{ color: 'var(--text3)', fontSize: '12px', marginLeft: '8px' }}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Movie card */}
        {isMovie && item.movieId && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
            {item.movieId.thumbnail ? (
              <img src={item.movieId.thumbnail} alt={item.movieId.title} style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 60, borderRadius: '6px', flexShrink: 0, background: item.movieId.color || '#1a237e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎬</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>{item.movieId.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{item.movieId.genre} · {item.movieId.year}</div>
              {!isRequest && <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>Tap to watch →</div>}
            </div>
          </div>
        )}

        {/* Party card */}
        {isParty && (
          <div
            style={{ background: 'rgba(229,57,53,0.07)', border: '0.5px solid rgba(229,57,53,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>🎉</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Watch Party Invite</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Join {sender?.username}'s party</div>
              </div>
            </div>
            {!isRequest && (
              <button className="btn btn-red btn-sm" onClick={e => { e.stopPropagation(); navigate(`/party/${item.roomId}`); }}>
                Join →
              </button>
            )}
          </div>
        )}

        {/* CHANGED: Accept / Decline buttons for request items */}
        {isRequest && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
            <button
              className="btn btn-red btn-sm"
              onClick={onAccept}
              style={{ flex: 1 }}
            >
              ✓ Accept
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onDecline}
              style={{ flex: 1, color: 'var(--text3)' }}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}