import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MovieCard({ movie, progress = null, showPartyBtn = false }) {
  const navigate = useNavigate();

  const runtime = movie.duration
    ? `${Math.floor(movie.duration / 60)}h ${movie.duration % 60}m`
    : null;

  const progressPct = progress && movie.duration
    ? Math.min(100, Math.round((progress / movie.duration) * 100))
    : null;

  return (
    <div
      className="movie-card"
      onClick={() => navigate(`/movie/${movie._id}`)}
    >
      {/* ── Thumbnail ──────────────────────────────── */}
      <div
        className="movie-card-thumb"
        style={{
          background: movie.color
            ? `linear-gradient(135deg, ${movie.color}, #000)`
            : 'var(--bg2)',
        }}
      >
        {movie.thumbnail ? (
          <img
            src={movie.thumbnail}
            alt={movie.title}
            loading="lazy"
            className="movie-card-img"
          />
        ) : (
          <div className="movie-card-no-thumb">
            <span className="movie-card-fallback-title">{movie.title}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="movie-card-overlay">
          <div className="movie-card-actions">
            <button
              className="btn btn-red btn-sm"
              onClick={(e) => { e.stopPropagation(); navigate(`/watch/${movie._id}`); }}
            >
              ▶ Watch
            </button>
            {showPartyBtn && (
              <button
                className="btn btn-ghost btn-sm movie-card-party-btn"
                onClick={(e) => { e.stopPropagation(); navigate(`/party/create/${movie._id}`); }}
              >
                🎉
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="movie-card-badges">
          {movie.isNew      && <span className="badge badge-green">New</span>}
          {movie.isTrending && <span className="badge badge-red">🔥</span>}
        </div>

        {/* Progress bar */}
        {progressPct !== null && (
          <div className="movie-card-prog-track">
            <div className="movie-card-prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* ── Card body ──────────────────────────────── */}
      <div className="movie-card-body">
        <div className="movie-card-title">{movie.title}</div>
        <div className="movie-card-meta">
          {[movie.genre, movie.year, runtime].filter(Boolean).join(' · ')}
        </div>
        {progressPct !== null && (
          <div className="movie-card-pct">{progressPct}% watched</div>
        )}
      </div>
    </div>
  );
}