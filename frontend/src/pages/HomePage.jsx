import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import movieService from '../services/movieService.js';
import MovieCard from '../components/MovieCard';
import toast from 'react-hot-toast';

import { getAvatarColor } from '../utils/avatar.js';
import partyService from '../services/partyService.js';

import { useSearch } from '../hooks/useSearch.js';
import SearchBar    from '../components/SearchBar';

export default function HomePage() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [trending,      setTrending]      = useState([]);
  const [continueWatch, setContinueWatch] = useState([]);
  const [byGenre,       setByGenre]       = useState({});
  const [publicRooms,   setPublicRooms]   = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [featuredIndex, setFeaturedIndex] = useState(0);
  const heroTimer = useRef(null);

  const search = useSearch({ movies: true, parties: true, users: false });
  useEffect(() => {
    const q = searchParams.get('search');
    if (q) search.setQuery(q);
  }, []); // eslint-disable-line

  // ── Load home data ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [t, cw, bg, pr] = await Promise.all([
          movieService.getTrending(),
          user ? movieService.getContinueWatching() : Promise.resolve([]),
          movieService.getByGenre(),
          partyService.getPublicRooms().catch(() => []),
        ]);
        setTrending(t   || []);
        setContinueWatch(cw || []);
        setByGenre(bg   || {});
        setPublicRooms(pr || []);
      } catch {
        toast.error('Failed to load content');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Hero auto-rotate ─────────────────────────────────────────────
  useEffect(() => {
    if (!trending.length) return;
    heroTimer.current = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % trending.length);
    }, 8000);
    return () => clearInterval(heroTimer.current);
  }, [trending]);

  const goToHero = (idx) => {
    clearInterval(heroTimer.current);
    setFeaturedIndex(idx);
    heroTimer.current = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % trending.length);
    }, 8000);
  };

  const scrollRow = useCallback((id, direction) => {
    const row = document.getElementById(id);
    if (!row) return;
    row.scrollBy({ left: direction === 'left' ? -1130 : 1130, behavior: 'smooth' });
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const featuredMovie = trending[featuredIndex] || null;
  const { isSearching, results } = search;

  return (
    <div className="page page--no-top-pad">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      {!isSearching && featuredMovie && (
        <section className="home-hero">
          {/* Animated background */}
          <div
            key={featuredIndex}
            className="home-hero-bg"
            style={{
              backgroundImage: featuredMovie.thumbnail
                ? `url(${featuredMovie.thumbnail})`
                : `linear-gradient(135deg, ${featuredMovie.color || '#1a237e'}, #000)`,
            }}
          />
          <div className="home-hero-overlay-v" />
          <div className="home-hero-overlay-h" />

          {/* Content */}
          <div className="home-hero-content">
            <div className="home-hero-badges">
              <span className="badge badge-red">🔥 Trending</span>
              <span className="badge badge-ghost">{featuredMovie.genre}</span>
              {featuredMovie.year  && <span className="badge badge-ghost">{featuredMovie.year}</span>}
              {featuredMovie.isNew && <span className="badge badge-green">New</span>}
            </div>

            <h1 className="home-hero-title">{featuredMovie.title}</h1>

            <p className="home-hero-desc">{featuredMovie.description}</p>

            <div className="home-hero-btns">
              <button className="btn btn-red btn-lg" onClick={() => navigate(`/watch/${featuredMovie._id}`)}>
                ▶ Watch Now
              </button>
              <button
                className="btn btn-ghost btn-lg hero-btn-party"
                onClick={() => navigate(`/party/create/${featuredMovie._id}`)}
              >
                🎉 Start Party
              </button>
              <button
                className="btn btn-ghost btn-lg hero-btn-info"
                onClick={() => navigate(`/movie/${featuredMovie._id}`)}
              >
                ℹ More Info
              </button>
            </div>
          </div>

          {/* Dots */}
          {trending.length > 1 && (
            <div className="home-hero-dots">
              {trending.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToHero(i)}
                  className={`home-hero-dot${i === featuredIndex ? ' active' : ''}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="container">

        {/* ── SEARCH BAR ──────────────────────────────────────────── */}
        <div className="home-search-wrap">
          <SearchBar
            query={search.query}
            setQuery={search.setQuery}
            results={search.results}
            isSearching={search.isSearching}
            loading={search.loading}
            clear={search.clear}
            showDropdown={false}
            placeholder="Search movies, parties…"
            maxWidth="440px"
          />
        </div>

        {/* ── SEARCH RESULTS ──────────────────────────────────────── */}
        {isSearching && (
          <section className="home-section">
            <div className="section-row">
              <div>
                <div className="section-eyebrow">Search Results</div>
                <div className="section-title">
                  {search.total} result{search.total !== 1 ? 's' : ''} for "{search.query}"
                </div>
              </div>
            </div>

            {search.loading ? (
              <div className="search-loading"><div className="spinner spinner--center" /></div>
            ) : search.total === 0 ? (
              <p className="text-muted">No results found. Try a different keyword.</p>
            ) : (
              <>
                {results.movies.length > 0 && (
                  <>
                    {results.parties.length > 0 && (
                      <div className="search-results-label">Movies</div>
                    )}
                    <div className={`movie-grid${results.parties.length ? ' movie-grid--mb' : ''}`}>
                      {results.movies.map(m => <MovieCard key={m._id} movie={m} showPartyBtn />)}
                    </div>
                  </>
                )}

                {results.parties.length > 0 && (
                  <>
                    <div className="search-results-label">Live Parties</div>
                    <div className="search-parties-grid">
                      {results.parties.map(room => (
                        <PartyCard key={room._id} room={room} onJoin={() => navigate(`/party/${room._id}`)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {/* ── CONTINUE WATCHING ───────────────────────────────────── */}
        {!isSearching && continueWatch.length > 0 && (
          <section className="home-section">
            <div className="section-row">
              <div>
                <div className="section-eyebrow">Pick Up Where You Left Off</div>
                <div className="section-title">Continue Watching</div>
              </div>
              <RowArrows id="continue-row" scrollRow={scrollRow} />
            </div>
            <div id="continue-row" className="movie-row">
              {continueWatch.map(item => (
                <div key={item.movie._id} className="movie-row-item">
                  <MovieCard movie={item.movie} progress={item.progress} showPartyBtn />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TRENDING ────────────────────────────────────────────── */}
        {!isSearching && trending.length > 0 && (
          <section className="home-section">
            <div className="section-row">
              <div>
                <div className="section-eyebrow">Popular Right Now</div>
                <div className="section-title">Trending Movies</div>
              </div>
              <RowArrows id="trending-row" scrollRow={scrollRow} />
            </div>
            <div id="trending-row" className="movie-row">
              {trending.map(m => (
                <div key={m._id} className="movie-row-item">
                  <MovieCard movie={m} showPartyBtn />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── LIVE PARTIES ─────────────────────────────────────────── */}
        {!isSearching && publicRooms.length > 0 && (
          <section className="home-section">
            <div className="section-row">
              <div>
                <div className="section-eyebrow">Join the Fun</div>
                <div className="section-title">Live Parties</div>
              </div>
              <RowArrows id="parties-row" scrollRow={scrollRow} />
            </div>
            <div id="parties-row" className="movie-row">
              {publicRooms.map(room => (
                <PartyCard key={room._id} room={room} onJoin={() => navigate(`/party/${room._id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* ── BY GENRE ────────────────────────────────────────────── */}
        {!isSearching && Object.entries(byGenre).map(([genre, movies], index) =>
          movies.length === 0 ? null : (
            <section key={genre} className="home-section">
              <div className="section-row">
                <div className="section-title">{genre}</div>
                <RowArrows id={`genre-row-${index}`} scrollRow={scrollRow} />
              </div>
              <div id={`genre-row-${index}`} className="movie-row">
                {movies.map(m => (
                  <div key={m._id} className="movie-row-item">
                    <MovieCard movie={m} showPartyBtn />
                  </div>
                ))}
              </div>
            </section>
          )
        )}

      </div>
    </div>
  );
}

// ── Row arrows ─────────────────────────────────────────────────────
function RowArrows({ id, scrollRow }) {
  return (
    <div className="row-arrows">
      <button className="btn btn-ghost btn-sm row-arrow-btn" onClick={() => scrollRow(id, 'left')}>←</button>
      <button className="btn btn-ghost btn-sm row-arrow-btn" onClick={() => scrollRow(id, 'right')}>→</button>
    </div>
  );
}

// ── Party card ─────────────────────────────────────────────────────
function PartyCard({ room, onJoin }) {
  const hostName = room.hostId?.username || 'Unknown';
  const color    = getAvatarColor(hostName);

  return (
    <div className="party-card">
      <div className="party-card-live-row">
        <span className="badge badge-red badge-live">Live</span>
        <span className="party-card-viewers">{room.participantCount || 1} watching</span>
      </div>

      <div className="party-card-name">
        {room.name || room.movieTitle}
      </div>

      <div className="party-card-host">
        <div className="party-card-host-avatar" style={{ background: color }}>
          {hostName.slice(0, 2).toUpperCase()}
        </div>
        <div className="party-card-host-label">
          Hosted by <strong>{hostName}</strong>
        </div>
      </div>

      {room.participants?.length > 0 && (
        <div className="party-card-participants">
          {room.participants.slice(0, 5).map((p, i) => (
            <div
              key={p._id || i}
              title={p.username}
              className="party-card-participant"
              style={{
                background: getAvatarColor(p.username),
                marginLeft: i === 0 ? 0 : '-7px',
                zIndex: 5 - i,
              }}
            >
              {p.username?.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {room.participants.length > 5 && (
            <span className="party-card-overflow">+{room.participants.length - 5} more</span>
          )}
        </div>
      )}

      <button className="btn btn-red btn-sm party-card-join-btn" onClick={onJoin}>
        Join Party →
      </button>
    </div>
  );
}