import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';
import { useSearch } from '../hooks/useSearch';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profileRef = useRef(null);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [mobileMenu,   setMobileMenu]   = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const search = useSearch({ movies: true, users: true, parties: true });

  // ── Close on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const closeAll = () => {
    setProfileOpen(false);
    setMobileMenu(false);
    setMobileSearch(false);
  };

  return (
    <>
      <nav className="navbar">

        {/* ── LEFT ───────────────────────────────────────────── */}
        <div className="navbar-left">
          {user && (
            <button
              id="mobile-menu-btn"
              className="btn btn-ghost btn-sm"
              onClick={() => { setMobileMenu(v => !v); setMobileSearch(false); }}
            >
              {mobileMenu ? '✕' : '☰'}
            </button>
          )}

          <Link to="/home" className="navbar-logo">
            WATCH<span>TOGETHER</span>
          </Link>

          {user && (
            <nav className="navbar-nav">
              <NavLink to="/home" end onClick={closeAll}>Home</NavLink>
              <NavLink to="/feed"     onClick={closeAll}>Feed</NavLink>
              <NavLink to="/discover" onClick={closeAll}>Live-Parties</NavLink>
              <NavLink to="/messages" onClick={closeAll}>Messages</NavLink>
            </nav>
          )}
        </div>

        {/* ── SEARCH (desktop) ───────────────────────────────── */}
        {user && (
          <div className="navbar-search">
            <SearchBar
              query={search.query}
              setQuery={search.setQuery}
              results={search.results}
              isSearching={search.isSearching}
              loading={search.loading}
              clear={search.clear}
              showDropdown={true}
              placeholder="Search movies, users, parties…"
              maxWidth="430px"
              onSelect={(item) => {
                search.clear();
                if (item._type === 'movie')  navigate(`/movie/${item._id}`);
                if (item._type === 'user')   navigate(`/profile/${item._id}`);
                if (item._type === 'party')  navigate(`/party/${item._id}`);
              }}
            />
          </div>
        )}

        {/* ── RIGHT ──────────────────────────────────────────── */}
        <div className="navbar-actions">
          {user ? (
            <>
              {/* Mobile search toggle */}
              <button
                className="btn btn-ghost btn-sm navbar-search-toggle"
                onClick={() => { setMobileSearch(v => !v); setMobileMenu(false); }}
                aria-label="Search"
              >
                🔍
              </button>

              <NotificationBell />

              <div ref={profileRef} className="navbar-profile-ref">
                {/* Desktop: pill with username */}
                <button
                  className="btn btn-ghost btn-sm navbar-profile-pill"
                  onClick={() => setProfileOpen(v => !v)}
                >
                  <div className="navbar-profile-chip">
                    {user.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="navbar-profile-name">{user.username}</span>
                </button>

                {/* Mobile: avatar circle only */}
                <button
                  className="navbar-profile-avatar"
                  onClick={() => setProfileOpen(v => !v)}
                  aria-label="Profile menu"
                >
                  {user.username?.slice(0, 2).toUpperCase()}
                </button>

                {profileOpen && (
                  <div className="navbar-dropdown">
                    <Link to={`/profile/${user._id}`} onClick={closeAll} className="navbar-dropdown-item">👤 Profile</Link>
                    <Link to="/feed"     onClick={closeAll} className="navbar-dropdown-item">🎬 Feed</Link>
                    <Link to="/settings" onClick={closeAll} className="navbar-dropdown-item">⚙️ Settings</Link>
                    <button
                      onClick={() => { closeAll(); handleLogout(); }}
                      className="navbar-dropdown-item navbar-dropdown-item--danger"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login"    className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-red btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Mobile search overlay ───────────────────────────── */}
      {user && mobileSearch && (
        <div className="navbar-mobile-search">
          <SearchBar
            query={search.query}
            setQuery={search.setQuery}
            results={search.results}
            isSearching={search.isSearching}
            loading={search.loading}
            clear={() => { search.clear(); setMobileSearch(false); }}
            showDropdown={true}
            placeholder="Search movies, users, parties…"
            maxWidth="100%"
            onSelect={(item) => {
              search.clear();
              setMobileSearch(false);
              if (item._type === 'movie')  navigate(`/movie/${item._id}`);
              if (item._type === 'user')   navigate(`/profile/${item._id}`);
              if (item._type === 'party')  navigate(`/party/${item._id}`);
            }}
          />
        </div>
      )}

      {/* ── Mobile nav drawer ──────────────────────────────── */}
      {user && mobileMenu && (
        <div className="navbar-mobile-menu">
          {[
            { to: '/home',     label: '🏠 Home' },
            { to: '/feed',     label: '📰 Feed' },
            { to: '/discover', label: '🌐 Live-Parties' },
            { to: '/messages', label: '💬 Messages' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeAll}>{label}</Link>
          ))}
        </div>
      )}
    </>
  );
}