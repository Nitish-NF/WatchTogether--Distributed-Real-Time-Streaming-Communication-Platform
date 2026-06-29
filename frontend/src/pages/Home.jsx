import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import movieService from '../services/movieService';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trending, setTrending] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [byGenre, setByGenre] = useState({});
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);

const scrollRow = (id, direction) => {

  const row = document.getElementById(id);

  if (!row) return;

  row.scrollBy({

    left: direction === 'left'
      ? -1130
      : 1130,

    behavior: 'smooth'

  });

};

  useEffect(() => {
    const load = async () => {
      try {
        const [trendData, contData, genreData] = await Promise.all([
          movieService.getTrending(),
          movieService.getContinueWatching(),
          movieService.getByGenre(),
        ]);
        setTrending(trendData);
        setContinueWatching(contData);
        setByGenre(genreData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await movieService.search(search);
        setSearchResults(results);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {

    if (!trending.length) return;

    const interval = setInterval(() => {

      setFeaturedIndex(prev =>
        (prev + 1) % trending.length
      );

    }, 8000);

    return () => clearInterval(interval);

  }, [trending]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const displayMovies = search.trim() ? searchResults : null;
  const featuredMovie = trending[featuredIndex] || null;

  return (
    <div className="page">
      <div className="container">

        {/* Hero Banner */}
        {!search && featuredMovie && (

          <section
            style={{

              position: 'relative',

              height: '80vh',

              minHeight: '360px',

              borderRadius: '24px',

              overflow: 'hidden',

              marginBottom: '3.5rem',

              background:
                featuredMovie.thumbnail
                  ? `url(${featuredMovie.thumbnail}) center/cover`
                  : `linear-gradient(
                      135deg,
                      ${featuredMovie.color || '#1a237e'},
                      #000
                    )`,

              display: 'flex',

              alignItems: 'flex-end',

              boxShadow:
                '0 20px 60px rgba(0,0,0,0.45)'

            }}
          >

            {/* Dark cinematic overlays */}
            <div
              style={{
                position: 'absolute',
                inset: 0,

                background: `
                  linear-gradient(
                    to top,
                    rgba(0,0,0,0.92) 5%,
                    rgba(0,0,0,0.45) 45%,
                    rgba(0,0,0,0.2) 100%
                  )
                `
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,

                background: `
                  linear-gradient(
                    to right,
                    rgba(0,0,0,0.8) 0%,
                    rgba(0,0,0,0.4) 45%,
                    transparent 100%
                  )
                `
              }}
            />

            {/* Content */}
            <div
              style={{
                position: 'relative',
                animation:'heroContent 0.8s ease',
                zIndex: 2,

                padding: '3rem',

                maxWidth: '680px'
              }}
            >

              {/* Top badges */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '18px',
                  flexWrap: 'wrap'
                }}
              >

                <span className="badge badge-red">
                  🔥 Trending
                </span>

                <span className="badge badge-ghost">
                  {featuredMovie.genre}
                </span>

                <span className="badge badge-ghost">
                  {featuredMovie.year}
                </span>

              </div>

              {/* Title */}
              <h1
                style={{

                  fontFamily:
                    'Bebas Neue, sans-serif',

                  fontSize: 'clamp(3rem, 7vw, 5.5rem)',

                  lineHeight: 0.95,

                  letterSpacing: '0.04em',

                  marginBottom: '1rem',

                  textShadow:
                    '0 6px 20px rgba(0,0,0,0.6)'

                }}
              >
                {featuredMovie.title}
              </h1>

              {/* Description */}
              <p
                style={{
                  color: 'rgba(255,255,255,0.82)',

                  fontSize: '15px',

                  lineHeight: 1.8,

                  maxWidth: '620px',

                  marginBottom: '2rem'
                }}
              >

                {featuredMovie.description
                  ?.slice(0, 220)}...

              </p>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  flexWrap: 'wrap'
                }}
              >

                <button
                  className="btn btn-red btn-lg"
                  onClick={() =>
                    navigate(
                      `/movie/${featuredMovie._id}`
                    )
                  }
                >
                  ▶ Watch Now
                </button>

                <button
                  className="btn btn-ghost btn-lg"
                  onClick={() =>
                    navigate(
                      `/movie/${featuredMovie._id}?party=new`
                    )
                  }
                >
                  🎉 Start Party
                </button>

              </div>

            </div>

          </section>

        )}

        {/* Search */}
        <div style={{ marginBottom: '2.5rem', position: 'relative', maxWidth: '440px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, genre, actor..."
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Search results */}
        {displayMovies && (
          <section style={{ marginBottom: '3rem' }}>
            <div className="section-row">
              <div>
                <div className="section-eyebrow">Search Results</div>
                <div className="section-title">{displayMovies.length} results for "{search}"</div>
              </div>
            </div>
            {displayMovies.length === 0
              ? <p className="text-muted">No results found.</p>
              : <div className="movie-grid">{displayMovies.map(m => <MovieCard key={m._id} movie={m} />)}</div>
            }
          </section>
        )}

        {/* Continue Watching */}
        {!displayMovies && continueWatching.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
          <div
            className="section-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >

            <div>

              <div className="section-eyebrow">
                Pick Up Where You Left Off
              </div>

              <div className="section-title">
                Continue Watching
              </div>

            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px'
              }}
            >

              <button
                className="btn btn-ghost"
                onClick={() =>
                  scrollRow(
                    'continue-row',
                    'left'
                  )
                }
              >
                ←
              </button>

              <button
                className="btn btn-ghost"
                onClick={() =>
                  scrollRow(
                    'continue-row',
                    'right'
                  )
                }
              >
                →
              </button>

            </div>

          </div>
            <div className="movie-row">
              {continueWatching.map(item => (
                <div key={item.movie._id} style={{ position: 'relative' }}>
                  <MovieCard movie={item.movie} />
                  <div style={{ position: 'absolute', bottom: '48px', left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.1)' }}>
                    <div style={{ height: '100%', width: `${(item.progress / item.movie.duration) * 100}%`, background: 'var(--red)', borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending */}
        {/* Trending */}
        {!displayMovies && (

          <section style={{ marginBottom: '3rem' }}>

            <div
              className="section-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}
            >

              <div>

                <div className="section-eyebrow">
                  Popular Right Now
                </div>

                <div className="section-title">
                  Trending Movies
                </div>

              </div>

              {/* Slider controls */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px'
                }}
              >

                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    scrollRow(
                      'trending-row',
                      'left'
                    )
                  }
                >
                  ←
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    scrollRow(
                      'trending-row',
                      'right'
                    )
                  }
                >
                  →
                </button>

              </div>

            </div>

            <div
              id="trending-row"
              className="movie-row"
            >

              {trending.map(m => (

                <MovieCard
                  key={m._id}
                  movie={m}
                />

              ))}

            </div>

          </section>

        )}

        {/* By Genre */}
        {!displayMovies &&

          Object.entries(byGenre).map(
            ([genre, movies], index) => (

              <section
                key={genre}
                style={{
                  marginBottom: '3rem'
                }}
              >

                {/* Header */}
                <div
                  className="section-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >

                  <div className="section-title">
                    {genre}
                  </div>

                  {/* Slider controls */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px'
                    }}
                  >

                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        scrollRow(
                          `genre-row-${index}`,
                          'left'
                        )
                      }
                    >
                      ←
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        scrollRow(
                          `genre-row-${index}`,
                          'right'
                        )
                      }
                    >
                      →
                    </button>

                  </div>

                </div>

                {/* Slider */}
                <div
                  id={`genre-row-${index}`}
                  className="movie-row"
                >

                  {movies.map(m => (

                    <MovieCard
                      key={m._id}
                      movie={m}
                    />

                  ))}

                </div>

              </section>

            )

        )}

      </div>
    </div>
  );
}
import React, { useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, useLocation,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import socket from './sockets/socket';

// ── Lazy pages ────────────────────────────────────────────────────
const LandingPage  = lazy(() => import('./pages/LandingPage'));
const HomePage     = lazy(() => import('./pages/HomePage'));
const LoginPage    = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MoviePage    = lazy(() => import('./pages/MoviePage'));
const Profile      = lazy(() => import('./pages/Profile'));
const FeedPage     = lazy(() => import('./pages/FeedPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const WatchParty   = lazy(() => import('./pages/WatchParty'));
const CreateParty  = lazy(() => import('./pages/CreateParty'));
const ShareMovie   = lazy(() => import('./pages/ShareMovie'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));

function PageSpinner() {
  return <div className="loading-screen"><div className="spinner" /></div>;
}

// ── Route guards ──────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Guest-only — redirect logged-in users to /home
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (user)    return <Navigate to="/home" replace />;
  return children;
}

// ── Socket: join personal user room ──────────────────────────────
function SocketUserRoom() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?._id) return;
    const userId = user._id;

    const joinRoom = () => {
      socket.emit('join_user_room', { userId });
    };

    // Always register first (handles future connects + reconnects)
    socket.on('connect', joinRoom);
    // Emit immediately if already connected
    if (socket.connected) joinRoom();

    return () => socket.off('connect', joinRoom);
  }, [user?._id]);

  // Global connection-lost handler
  useEffect(() => {
    const onFailed = () => console.error('[Socket] Connection permanently lost.');
    window.addEventListener('socket:connection_failed', onFailed);
    return () => window.removeEventListener('socket:connection_failed', onFailed);
  }, []);

  return null;
}

// ── Layout: Navbar only shown on authenticated pages ─────────────
function AuthenticatedLayout({ children }) {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <SocketUserRoom />
        {children}
      </div>
    </>
  );
}

// ── Routes ────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>

        {/* ── PUBLIC (no navbar) ────────────────────────────────── */}

        {/* Landing page — first thing unauthenticated users see */}
        <Route
          path="/"
          element={
            <GuestOnly>
              <LandingPage />
            </GuestOnly>
          }
        />

        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />

        {/* ── AUTHENTICATED (with Navbar) ───────────────────────── */}

        <Route
          path="/home"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <HomePage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/feed"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <FeedPage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/discover"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <DiscoverPage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/movie/:id"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <MoviePage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <Profile />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <MessagesPage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <MessagesPage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/party/create/:movieId"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <CreateParty />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/party/:roomId"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <WatchParty />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/share/movie/:movieId"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <ShareMovie />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <AuthenticatedLayout>
                <SettingsPage />
              </AuthenticatedLayout>
            </RequireAuth>
          }
        />

        {/* Catch-all — unauthenticated → landing, authenticated → home */}
        <Route path="*" element={<SmartRedirect />} />

      </Routes>
    </Suspense>
  );
}

// Redirect to /home if logged in, else /
function SmartRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  return <Navigate to={user ? '/home' : '/'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--bg3)',
              color:      'var(--text)',
              border:     '0.5px solid var(--border2)',
              fontSize:   '13.5px',
            },
            success: { iconTheme: { primary: '#4caf50', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#e53935', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}