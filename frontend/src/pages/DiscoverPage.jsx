import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../sockets/socket';
import toast from 'react-hot-toast';

import { getAvatarColor } from '../utils/avatar';
import partyService from '../services/partyService';

// CHANGED: import reusable hook + component
import { useSearch } from '../hooks/useSearch';
import SearchBar    from '../components/SearchBar';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);

  // CHANGED: was no search at all.
  // Now: parties + movies scoped search.
  // showDropdown=false — results replace the room grid inline.
  const search = useSearch({ movies: true, parties: true, users: false });

  // ── Load public rooms ────────────────────────────────────────────
  useEffect(() => {
    partyService.getPublicRooms()
      .then(data => setRooms(data || []))
      .catch(() => toast.error('Could not load rooms'))
      .finally(() => setLoading(false));
  }, []);

  // ── Real-time participant count updates ──────────────────────────
  useEffect(() => {
    const onJoin = ({ roomId }) => {
      setRooms(prev => prev.map(r =>
        r._id === roomId ? { ...r, participantCount: (r.participantCount || 0) + 1 } : r
      ));
    };
    const onLeave = ({ roomId }) => {
      setRooms(prev => prev.map(r =>
        r._id === roomId ? { ...r, participantCount: Math.max(0, (r.participantCount || 1) - 1) } : r
      ));
    };
    socket.on('room_participant_joined', onJoin);
    socket.on('room_participant_left',   onLeave);
    return () => {
      socket.off('room_participant_joined', onJoin);
      socket.off('room_participant_left',   onLeave);
    };
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  // Decide what to render in the grid area
  const { isSearching, results } = search;
  const displayRooms = isSearching ? results.parties : rooms;

  return (
    <div className="page">
      <div className="container">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-eyebrow">Live Now</div>
          <div className="section-title">Discover Watch Parties</div>
          <p style={{ fontSize: '13.5px', color: 'var(--text2)', marginTop: '6px' }}>
            Join a public room and watch together with strangers.
          </p>
        </div>

        {/* ── Search bar ──────────────────────────────────────────── */}
        {/* CHANGED: new addition — was no search on this page.
            Scoped to parties + movies.
            showDropdown=false, results render below as grids. */}
        <div style={{ marginBottom: '1.8rem', maxWidth: '480px' }}>
          <SearchBar
            query={search.query}
            setQuery={search.setQuery}
            results={search.results}
            isSearching={search.isSearching}
            loading={search.loading}
            clear={search.clear}
            showDropdown={false}
            placeholder="Search parties or movies…"
            maxWidth="480px"
          />
        </div>

        {/* ── Search state heading ─────────────────────────────────── */}
        {isSearching && (
          <div style={{ marginBottom: '1.2rem' }}>
            <div className="section-eyebrow">Search Results</div>
            <div className="section-title" style={{ fontSize: '1.1rem' }}>
              {search.total} result{search.total !== 1 ? 's' : ''} for "{search.query}"
            </div>
          </div>
        )}

        {search.loading && isSearching ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <>
            {/* ── Party results / live rooms grid ───────────────────── */}
            {isSearching && results.parties.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Live Parties
                </div>
                <RoomGrid rooms={results.parties} onJoin={(id) => navigate(`/party/${id}`)} />
              </div>
            )}

            {/* Default (no search) live rooms */}
            {!isSearching && (
              displayRooms.length === 0 ? (
                <EmptyState />
              ) : (
                <RoomGrid rooms={displayRooms} onJoin={(id) => navigate(`/party/${id}`)} />
              )
            )}

            {/* ── Movie results (only shown during search) ─────────── */}
            {/* CHANGED: new section — discover page now also surfaces
                movies matching the query so users can start a party. */}
            {isSearching && results.movies.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Movies — Start a Party
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '14px',
                }}>
                  {results.movies.map(movie => (
                    <MovieResultCard
                      key={movie._id}
                      movie={movie}
                      onWatch={() => navigate(`/watch/${movie._id}`)}
                      onParty={() => navigate(`/party/create/${movie._id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No results at all during search */}
            {isSearching && search.total === 0 && !search.loading && (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text3)', fontSize: '14px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: '6px' }}>No results for "{search.query}"</div>
                Try a different movie title or party name.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Room grid ──────────────────────────────────────────────────────
function RoomGrid({ rooms, onJoin }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px',
    }}>
      {rooms.map(room => (
        <RoomCard key={room._id} room={room} onJoin={() => onJoin(room._id)} />
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text3)', fontSize: '14px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
      <div style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: '6px' }}>No live parties right now</div>
      Start one from any movie page!
    </div>
  );
}

// ── Room card — unchanged from original ───────────────────────────
function RoomCard({ room, onJoin }) {
  const hostName = room.hostId?.username || 'Unknown';
  const color    = getAvatarColor(hostName);
  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.2s, border-color 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '14.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.name || room.movieTitle}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '3px' }}>🎬 {room.movieTitle}</div>
        </div>
        <span className="badge badge-red badge-live" style={{ flexShrink: 0 }}>Live</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
          {hostName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{hostName}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text3)' }}>Host</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{room.participantCount || 1}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>watching</div>
        </div>
      </div>
      {room.participants?.length > 0 && (
        <div style={{ display: 'flex' }}>
          {room.participants.slice(0, 5).map((p, i) => (
            <div key={p._id || i} style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(p.username), border: '2px solid var(--bg3)', marginLeft: i === 0 ? 0 : '-6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 600 }}>
              {p.username?.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {room.participants.length > 5 && (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg2)', border: '2px solid var(--bg3)', marginLeft: '-6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--text3)' }}>
              +{room.participants.length - 5}
            </div>
          )}
        </div>
      )}
      <button className="btn btn-red btn-sm" onClick={onJoin} style={{ marginTop: 'auto' }}>Join Party →</button>
    </div>
  );
}

// ── Movie result card (new — only shown during search) ─────────────
// CHANGED: new component — lets users start a party directly from
// a movie that matched their search query on the Discover page.
function MovieResultCard({ movie, onWatch, onParty }) {
  return (
    <div className="card" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
      <div style={{ width: 48, height: 68, borderRadius: '8px', background: movie.color || '#1a237e', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
        {movie.thumbnail && (
          <img src={movie.thumbnail} alt={movie.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movie.title}</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '2px' }}>{[movie.genre, movie.year].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} onClick={onWatch}>▶ Watch</button>
          <button className="btn btn-red btn-sm"   style={{ fontSize: '11px' }} onClick={onParty}>🎉 Start Party</button>
        </div>
      </div>
    </div>
  );
}