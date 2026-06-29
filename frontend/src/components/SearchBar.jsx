import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarColor } from '../utils/avatar';

/**
 * SearchBar — drop-in search input with optional inline results dropdown.
 *
 * Props:
 *   query        — controlled value (from useSearch)
 *   setQuery     — setter          (from useSearch)
 *   results      — { movies, users, parties } (from useSearch)
 *   isSearching  — bool (from useSearch)
 *   loading      — bool (from useSearch)
 *   clear        — reset fn (from useSearch)
 *   showDropdown — show inline dropdown (default true)
 *   placeholder  — input placeholder text
 *   maxWidth     — CSS max-width string (default '430px')
 *   onSelect     — optional override callback(item) instead of navigation
 */
export default function SearchBar({
  query,
  setQuery,
  results,
  isSearching,
  loading,
  clear,
  showDropdown = true,
  placeholder  = 'Search movies, users, parties…',
  maxWidth     = '430px',
  onSelect,
}) {
  const navigate = useNavigate();

  const allResults = [
    ...(results.movies  || []).map(m => ({ ...m, _type: 'movie'  })),
    ...(results.users   || []).map(u => ({ ...u, _type: 'user'   })),
    ...(results.parties || []).map(p => ({ ...p, _type: 'party'  })),
  ];

  const handleSelect = (item) => {
    if (onSelect) { onSelect(item); return; }
    clear();
    if (item._type === 'movie')  navigate(`/movie/${item._id}`);
    if (item._type === 'user')   navigate(`/profile/${item._id}`);
    if (item._type === 'party')  navigate(`/party/${item._id}`);
  };

  return (
    <div className="searchbar-outer" style={{ maxWidth }}>

      {/* ── Input ─────────────────────────────────────────── */}
      <div className="searchbar-wrap">
        <span className="searchbar-icon">
          {loading ? '⏳' : '🔍'}
        </span>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className={query ? 'searchbar-input searchbar-input--has-value' : 'searchbar-input'}
        />

        {query && (
          <button className="searchbar-clear" onClick={clear}>×</button>
        )}
      </div>

      {/* ── Dropdown ──────────────────────────────────────── */}
      {showDropdown && isSearching && (
        <div className="searchbar-dropdown">
          {loading ? (
            <div className="searchbar-loading">
              <div className="spinner spinner--center" />
            </div>
          ) : allResults.length === 0 ? (
            <div className="searchbar-empty">
              No results for "{query}"
            </div>
          ) : (
            <>
              {results.movies?.length > 0 && (
                <>
                  <SectionLabel label="Movies" />
                  {results.movies.slice(0, 4).map(item => (
                    <DropdownRow key={'m-' + item._id} item={{ ...item, _type: 'movie' }} onSelect={handleSelect} />
                  ))}
                </>
              )}

              {results.users?.length > 0 && (
                <>
                  <SectionLabel label="People" />
                  {results.users.slice(0, 3).map(item => (
                    <DropdownRow key={'u-' + item._id} item={{ ...item, _type: 'user' }} onSelect={handleSelect} />
                  ))}
                </>
              )}

              {results.parties?.length > 0 && (
                <>
                  <SectionLabel label="Live Parties" />
                  {results.parties.slice(0, 3).map(item => (
                    <DropdownRow key={'p-' + item._id} item={{ ...item, _type: 'party' }} onSelect={handleSelect} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────
function SectionLabel({ label }) {
  return (
    <div className="searchbar-section-label">{label}</div>
  );
}

// ── Single dropdown row ────────────────────────────────────────────
function DropdownRow({ item, onSelect }) {
  const label = item.title || item.username || item.name || item.movieTitle;
  const sub   = item._type === 'movie'
    ? [item.genre, item.year].filter(Boolean).join(' · ')
    : item._type === 'user'
    ? `@${item.username}`
    : `${item.participantCount || 1} watching · ${item.movieTitle || ''}`;

  const avatarBg = item._type === 'user'
    ? getAvatarColor(item.username)
    : item.color || '#1a237e';

  const thumbClass = `searchbar-row-thumb searchbar-row-thumb--${item._type}`;

  const icon = () => {
    if (item._type === 'party') return '🎉';
    if (item._type === 'user')  return item.username?.slice(0, 2).toUpperCase();
    return item.thumbnail
      ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : '🎬';
  };

  return (
    <div className="searchbar-row" onClick={() => onSelect(item)}>
      {/* Thumbnail / avatar */}
      <div className={thumbClass} style={{ background: avatarBg }}>
        {icon()}
      </div>

      {/* Text */}
      <div className="searchbar-row-text">
        <div className="searchbar-row-title">{label}</div>
        <div className="searchbar-row-sub">{sub}</div>
      </div>

      {/* Party live badge */}
      {item._type === 'party' && (
        <span className="badge badge-red badge-live searchbar-live-badge">Live</span>
      )}
    </div>
  );
}