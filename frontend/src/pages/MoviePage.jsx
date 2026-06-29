import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import movieService from '../services/movieService';
import MovieCard from '../components/MovieCard';
import toast from 'react-hot-toast';

export default function MoviePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    movieService.getById(id)
      .then(setMovie)
      .catch(() => toast.error('Movie not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStartParty = () => {
    setStarting(true);
    navigate(`/party/create/${movie._id}`);
  };

  const handleShare = () => navigate(`/share/movie/${id}`);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!movie)  return <div className="page"><div className="container">Movie not found.</div></div>;

  const runtime = movie.duration
    ? `${Math.floor(movie.duration / 60)}h ${movie.duration % 60}m`
    : null;

  return (
    <div className="page">

      {/* ── HERO ── */}
      <div
        className="movie-hero"
        style={{
          background: `linear-gradient(180deg, transparent 0%, var(--bg) 100%),
                       linear-gradient(135deg, ${movie.color || '#1a237e'} 0%, #000 100%)`,
        }}
      >
        <div className="container movie-hero-inner">

          {/* Poster */}
          <div className="movie-hero-poster">
            {movie.thumbnail ? (
              <img
                src={movie.thumbnail}
                alt={movie.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span className="movie-hero-poster-fallback">{movie.title}</span>
            )}
          </div>

          {/* Info */}
          <div className="movie-hero-info">
            <div className="movie-hero-badges">
              <span className="badge badge-red">{movie.genre}</span>
              {movie.isNew      && <span className="badge badge-green">New</span>}
              {movie.isTrending && <span className="badge badge-red">🔥 Trending</span>}
              {movie.rating != null && (
                <span className="badge badge-yellow">★ {movie.rating}</span>
              )}
            </div>

            <h1 className="movie-hero-title">{movie.title}</h1>

            <div className="movie-hero-meta">
              {[movie.language, runtime, movie.year].filter(Boolean).join(' · ')}
            </div>

            <p className="movie-hero-desc">{movie.description}</p>

            {/* ── All 3 buttons always visible ── */}
            <div className="movie-hero-btns">
              <button
                className="btn btn-red btn-lg"
                onClick={() => navigate(`/watch/${movie._id}`)}
              >
                ▶ Watch Now
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={handleStartParty}
                disabled={starting}
              >
                {starting ? 'Creating…' : '🎉 Watch Party'}
              </button>
              <button className="btn btn-ghost btn-lg" onClick={handleShare}>
                ↗ Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MORE LIKE THIS — horizontal scroll ── */}
      {movie.related?.length > 0 && (
        <div className="container" style={{ marginTop: '2rem' }}>
          <div className="section-eyebrow mb-2">More Like This</div>
          <div className="movie-scroll-row">
            {movie.related.map(m => (
              <div key={m._id} className="movie-scroll-item">
                <MovieCard movie={m} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}