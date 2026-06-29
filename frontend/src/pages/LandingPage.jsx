import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import movieService from '../services/movieService';
import partyService from '../services/partyService';

// ── FAQ data ──────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'What is WatchTogether?',
    a: 'WatchTogether is a streaming platform that lets you watch movies and series with friends in real time — with live cameras, perfectly synced playback, and a built-in party chat. No matter where your friends are, you watch together.',
  },
  {
    q: 'How much does WatchTogether cost?',
    a: 'Plans start at ₹149/month. You can cancel at any time — no contracts, no hidden fees.',
  },
  {
    q: 'Where can I watch?',
    a: 'Watch anywhere, anytime. Sign in on the web from any browser, or on any internet-connected device. Downloads are coming soon for mobile.',
  },
  {
    q: 'How does the Watch Party work?',
    a: 'Start a party from any movie page. Invite followers or share a link. Everyone\'s playback is synced automatically — play, pause, and seek together. You can see each other live via cameras while watching.',
  },
  {
    q: 'How do I cancel?',
    a: 'Cancel anytime from your account settings in two clicks. No cancellation fees.',
  },
  {
    q: 'Is WatchTogether good for kids?',
    a: 'Yes. WatchTogether supports multiple profiles per account. Parents can set up a kids profile with PIN-protected parental controls to restrict content by maturity rating.',
  },
];

// ── Feature cards ─────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '🎬',
    title: 'Watch together in real time',
    desc: 'Enjoy movies and TV shows with friends on the same screen while seeing each other live — no matter where you are.',
    gradient: 'linear-gradient(135deg, #1c1c3c, #2a0a3d)',
  },
  {
    icon: '📹',
    title: 'Live video with friends',
    desc: "See your friends' reactions while watching with built-in live camera and voice.",
    gradient: 'linear-gradient(135deg, #1a1a0a, #2d1a00)',
  },
  {
    icon: '🔄',
    title: 'Perfectly synced playback',
    desc: 'Play, pause, and seek together. Everyone watches at the same moment with automatic sync.',
    gradient: 'linear-gradient(135deg, #0a1a1a, #002d2a)',
  },
  {
    icon: '↗️',
    title: 'Share movies instantly',
    desc: 'Share movies and watch-party invites with followers — just like sharing a reel on Instagram.',
    gradient: 'linear-gradient(135deg, #1a0a1a, #2d002d)',
  },
];

// ── Stat counters ─────────────────────────────────────────────────
const STATS = [
  { value: '10K+', label: 'Active Users' },
  { value: '500+', label: 'Movies' },
  { value: '50K+', label: 'Parties Hosted' },
  { value: '4.9★', label: 'User Rating' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const [email,        setEmail]        = useState('');
  const [openFaq,      setOpenFaq]      = useState(null);
  const [trendMovies,  setTrendMovies]  = useState([]);
  const [liveParties,  setLiveParties]  = useState([]);
  const [heroIndex,    setHeroIndex]    = useState(0);
  const heroTimer = useRef(null);

  // Load public trending movies and live parties (no auth needed)
  useEffect(() => {
    movieService.getTrending().then(d => setTrendMovies(d || [])).catch(() => {});
    partyService.getPublicRooms().then(d => setLiveParties(d || [])).catch(() => {});
  }, []);

  // Auto-rotate hero
  useEffect(() => {
    if (!trendMovies.length) return;
    heroTimer.current = setInterval(() => {
      setHeroIndex(i => (i + 1) % Math.min(trendMovies.length, 5));
    }, 6000);
    return () => clearInterval(heroTimer.current);
  }, [trendMovies]);

  const hero = trendMovies[heroIndex];

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      navigate(`/register?email=${encodeURIComponent(email.trim())}`);
    } else {
      navigate('/register');
    }
  };

  const redirectLogin = (e) => {
    e.preventDefault();
    navigate('/login');
  };

  const toggleFaq = (i) => setOpenFaq(prev => prev === i ? null : i);

  return (
    <div className="landing">

      {/* ══════════════════════════════════════════════
          HERO — full-viewport with movie backdrop
          ══════════════════════════════════════════════ */}
      <section className="landing-hero">
        {/* Animated background */}
        <div
          className="landing-hero-bg"
          key={heroIndex}
          style={{
            backgroundImage: hero?.thumbnail
              ? `url(${hero.thumbnail})`
              : `linear-gradient(135deg, #1a237e, #000)`,
          }}
        />
        <div className="landing-hero-overlay-v" />
        <div className="landing-hero-overlay-h" />

        {/* Content */}
        <div className="landing-hero-content">
          <div className="landing-hero-badge">🎬 Now Streaming</div>

          <h1 className="landing-hero-title">
            Watch movies &amp; series<br />
            <span>together</span>, live
          </h1>

          <p className="landing-hero-sub">
            Sync your screen with friends. See each other live. Chat while watching.
          </p>

          {/* Email CTA */}
          <form className="landing-email-form" onSubmit={handleEmailSubmit}>
            <div className="landing-email-input-wrap">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder=" "
                className="landing-email-input"
              />
              <label className="landing-email-label">Email address</label>
            </div>
            <button type="submit" className="landing-cta-btn">
              Get Started <span>›</span>
            </button>
          </form>
        </div>

        {/* Hero dots */}
        {trendMovies.length > 1 && (
          <div className="landing-hero-dots">
            {trendMovies.slice(0, 5).map((_, i) => (
              <button
                key={i}
                className={`landing-hero-dot${i === heroIndex ? ' active' : ''}`}
                onClick={() => {
                  clearInterval(heroTimer.current);
                  setHeroIndex(i);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════
          STATS BAR
          ══════════════════════════════════════════════ */}
      <div className="landing-stats">
        {STATS.map(({ value, label }) => (
          <div key={label} className="landing-stat">
            <div className="landing-stat-val">{value}</div>
            <div className="landing-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          TRENDING MOVIES (public preview)
          ══════════════════════════════════════════════ */}
      {trendMovies.length > 0 && (
        <section className="landing-section">
          <div className="container">
            <div className="landing-section-header">
              <div>
                <div className="section-eyebrow">Popular Right Now</div>
                <h2 className="landing-section-title">Trending Movies</h2>
              </div>
              <Link to="/login" className="landing-see-all">
                Sign in to watch →
              </Link>
            </div>

            <div className="landing-movie-row">
              {trendMovies.slice(0, 8).map(m => (
                <div
                  key={m._id}
                  className="landing-movie-card"
                  onClick={redirectLogin}
                  title="Sign in to watch"
                >
                  <div className="landing-movie-thumb" style={{
                    background: m.color
                      ? `linear-gradient(135deg, ${m.color}, #000)`
                      : 'var(--bg2)',
                  }}>
                    {m.thumbnail ? (
                      <img src={m.thumbnail} alt={m.title} loading="lazy" />
                    ) : (
                      <span className="landing-movie-no-thumb">{m.title}</span>
                    )}
                    {m.isTrending && (
                      <span className="landing-movie-badge">🔥</span>
                    )}
                    <div className="landing-movie-hover">
                      <span className="landing-movie-play">▶ Watch</span>
                    </div>
                  </div>
                  <div className="landing-movie-info">
                    <div className="landing-movie-title">{m.title}</div>
                    <div className="landing-movie-meta">
                      {[m.genre, m.year].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          LIVE WATCH PARTIES
          ══════════════════════════════════════════════ */}
      {liveParties.length > 0 && (
        <section className="landing-section landing-section-alt">
          <div className="container">
            <div className="landing-section-header">
              <div>
                <div className="section-eyebrow">Happening Now</div>
                <h2 className="landing-section-title">Live Watch Parties</h2>
              </div>
              <Link to="/login" className="landing-see-all">
                Join a party →
              </Link>
            </div>

            <div className="landing-parties-grid">
              {liveParties.slice(0, 4).map(room => (
                <div
                  key={room._id}
                  className="landing-party-card"
                  onClick={redirectLogin}
                >
                  <div className="landing-party-top">
                    <span className="badge badge-red badge-live">Live</span>
                    <span className="landing-party-viewers">
                      👥 {room.participantCount || 1}
                    </span>
                  </div>
                  <div className="landing-party-name">
                    {room.name || room.movieTitle}
                  </div>
                  <div className="landing-party-host">
                    Hosted by <strong>{room.hostId?.username || 'Someone'}</strong>
                  </div>
                  <button className="btn btn-red btn-sm" style={{ marginTop: 'auto' }}>
                    Join Party →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          FEATURES GRID
          ══════════════════════════════════════════════ */}
      <section className="landing-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div className="section-eyebrow">Why WatchTogether</div>
            <h2 className="landing-section-title">More reasons to join</h2>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map(({ icon, title, desc, gradient }) => (
              <div
                key={title}
                className="landing-feature-card"
                style={{ background: gradient }}
              >
                <div className="landing-feature-icon">{icon}</div>
                <h3 className="landing-feature-title">{title}</h3>
                <p className="landing-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════ */}
      <section className="landing-section landing-section-alt">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="section-eyebrow">Simple Setup</div>
          <h2 className="landing-section-title" style={{ marginBottom: '3rem' }}>
            Start watching together in 3 steps
          </h2>
          <div className="landing-steps">
            {[
              { n: '1', icon: '✉️', title: 'Create an account', desc: 'Sign up with your email in seconds.' },
              { n: '2', icon: '🎬', title: 'Pick a movie', desc: 'Browse trending titles or search for your favourite.' },
              { n: '3', icon: '🎉', title: 'Start a party', desc: 'Invite friends and watch together — live cameras included.' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className="landing-step">
                <div className="landing-step-num">{n}</div>
                <div className="landing-step-icon">{icon}</div>
                <h4 className="landing-step-title">{title}</h4>
                <p className="landing-step-desc">{desc}</p>
              </div>
            ))}
          </div>
          <button
            className="btn btn-red btn-lg"
            onClick={() => navigate('/register')}
            style={{ marginTop: '2.5rem' }}
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FAQ
          ══════════════════════════════════════════════ */}
      <section className="landing-section">
        <div className="container landing-faq-wrap">
          <h2 className="landing-section-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            Frequently Asked Questions
          </h2>

          <div className="landing-faq-list">
            {FAQS.map((faq, i) => (
              <div key={i} className="landing-faq-item">
                <button
                  className={`landing-faq-btn${openFaq === i ? ' open' : ''}`}
                  onClick={() => toggleFaq(i)}
                >
                  <span>{faq.q}</span>
                  <span className="landing-faq-icon">
                    {openFaq === i ? '✕' : '+'}
                  </span>
                </button>
                <div
                  className="landing-faq-answer"
                  style={{ maxHeight: openFaq === i ? '400px' : '0' }}
                >
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="landing-bottom-cta">
            <p>Ready to watch? Enter your email to get started.</p>
            <form className="landing-email-form" onSubmit={handleEmailSubmit}>
              <div className="landing-email-input-wrap">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder=" "
                  className="landing-email-input"
                />
                <label className="landing-email-label">Email address</label>
              </div>
              <button type="submit" className="landing-cta-btn">
                Get Started <span>›</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════ */}
      <footer className="landing-footer">
        <div className="container">
          <div className="landing-footer-top">
            <div className="landing-nav-logo" style={{ fontSize: '1.3rem', marginBottom: '8px' }}>
              WATCH<span>TOGETHER</span>
            </div>
            <p style={{ color: 'var(--text3)', fontSize: '13px', maxWidth: '340px' }}>
              Watch movies and series with friends in real time. Live cameras, synced playback, party chat.
            </p>
          </div>
          <div className="landing-footer-links">
            {['FAQ', 'Privacy', 'Terms', 'Contact', 'Help'].map(l => (
              <Link key={l} to="/login" style={{ color: 'var(--text3)', fontSize: '13px' }}>
                {l}
              </Link>
            ))}
          </div>
          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} WatchTogether. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}