import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import movieService from '../services/movieService';
import partyService from '../services/partyService';
import { formatStreamUrl } from '../utils/media';
import { FaArrowCircleLeft } from "react-icons/fa";
import { RiLiveFill } from "react-icons/ri";
import { TfiLayoutGrid2 } from "react-icons/tfi";
import { FaLink } from "react-icons/fa6";

import toast from 'react-hot-toast';
import userService from '../services/userService';

export default function SoloWatch() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [resumeTime, setResumeTime] = useState(null);
  const [liveParties, setLiveParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const progressRef = useRef(0);

  const saveCurrentProgress = () => {
    if (progressRef.current > 5) {
      userService.saveProgress(movieId, progressRef.current).catch(console.error);
    }
  };

  useEffect(() => {
    const loadMovie = async () => {
      try {
        const movieData = await movieService.getById(movieId);
        movieData.streamUrl = formatStreamUrl(movieData.streamUrl);
        setMovie(movieData);
        setResumeTime(movieData.progress || 0);
      } catch {
        toast.error('Movie not found');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    loadMovie();
  }, [movieId, navigate]);

  // Load live parties for this movie
  useEffect(() => {
    if (!movie) return;
    // ✅ fetch only parties for this movie directly from backend
    partyService.getPublicRooms(movieId)
      .then(rooms => setLiveParties(rooms.slice(0, 3)))
      .catch(console.error);
  }, [movie, movieId]);

  // useEffect(() => {
  //   if (!movie) return;
  //   const interval = setInterval(saveCurrentProgress, 15_000);
  //   return () => { clearInterval(interval); saveCurrentProgress(); };
  // }, [movie]);

  useEffect(() => {
    const handleBeforeUnload = () => saveCurrentProgress();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [movieId]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className='solo-container' style={{
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'grid',
        // ✅ desktop: two columns | mobile: single column
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '16px',
      }}
        className="solo-layout"
      >

        {/* LEFT COL — video, buttons, description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/')}
              style={{fontSize:'20px'}}
            >
              <FaArrowCircleLeft />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied!');
              }}
            >
              <FaLink/>
              Copy-link
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigate(`/share/movie/${movieId}`)
              }}
            >
              Share-Movie
            </button>
            <button
              className="btn btn-red btn-sm"
              onClick={() => navigate(`/party/create/${movieId}`)}
            >
              🎉 Create party
            </button>
          </div>
          {resumeTime !== null && (
            <VideoPlayer
              src={movie?.streamUrl}
              autoPlay
              isSolo={true}
              startTime={resumeTime}
              onProgress={(time) => { progressRef.current = time; }}
              onPauseSave={saveCurrentProgress}
            />
          )}

          {/* Title + meta */}
            {/* Description */}
            <div style={{
              background: 'var(--surface)',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.6,
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color:'var(--text)' }}>{movie?.title}</h2>
              {movie?.description}
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>
                {[movie?.year, movie?.genre, `${Math.floor((movie?.duration || 0) / 60)} min`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div>
          </div>
        </div>
        {console.log(liveParties)}
        {/* RIGHT COL — parties + more like this */}
        <div className='right-solo-layout' style={{ paddingTop:'16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* ✅ Live parties section */}
          <div className="div" style={{display:'flex',gap:'5px',fontSize: '14px', fontWeight: 500, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{paddingTop:'1px'}}>
            <RiLiveFill />
            </div>
            <div>
            <p >
              : Live parties on this movie
            </p>
            </div>
            
          </div>
          {liveParties.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text3)' }}>No live parties right now.</p>
          ) : liveParties.map(party => (
            <div key={party._id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '8px',
              border: '0.5px solid var(--border)',
              background: 'var(--surface)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                 {
                    party.name ||
                    [party.hostId?.username, "Party"]
                      .filter(Boolean)
                      .join("'s ")
                  }
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  <span style={{ color: '#e24b4a' }}>● </span>
                  {party.participantCount} watching
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                onClick={() => navigate(`/profile/${party.hostId?._id}`)}
              >
                Profile
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                onClick={() => navigate(`/party/${party._id}`)}
              >
                Join
              </button>
            </div>
          ))}

          <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', margin: '4px 0' }} />

          {/* ✅ More like this */}
          <div className="div" style={{display:'flex',gap:'5px',fontSize: '14px', fontWeight: 500, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{paddingTop:'1px'}}>
              <TfiLayoutGrid2 />
            </div>
            <div>
              <p >
                : more like this
              </p>
            </div>
          </div>

          {(!movie?.related || movie.related.length === 0) ? (
            <p style={{ fontSize: '12px', color: 'var(--text3)' }}>No recommendations available.</p>
          ) : movie?.related?.map(rec => (
              <div key={rec._id}  style={{
                display: 'flex', gap: '10px',
                paddingBottom: '8px',
                borderBottom: '0.5px solid var(--border)',
              }}>
                {/* Thumbnail */}
                <div style={{
                  width: '90px', minWidth: '90px', height: '100%',
                  borderRadius: '6px', overflow: 'hidden',
                  background: rec.color || '#222',
                }}>
                  {rec.thumbnail
                    ? <img src={rec.thumbnail} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: rec.color || '#333' }} />
                  }
                </div>

                {/* Info */}
                <div className="mobile-btn">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rec.title}
                  </p>

                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                    {[rec.genre, rec.year, rec.language].filter(Boolean).join(' · ')}
                  </p>

                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>
                    {Math.floor((rec.duration || 0) / 60)}h {(rec.duration || 0) % 60}m
                    {rec.isTrending && <span style={{ color: '#e24b4a', marginLeft: '6px' }}>🔥 Trending</span>}
                    {rec.isNew && <span style={{ color: '#1d9e75', marginLeft: '6px' }}>✦ New</span>}
                  </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                    <button
                      className="btn btn-red btn-sm"
                      style={{ fontSize: '10px', padding: '2px 8px' }}
                      onClick={() => navigate(`/watch/${rec._id}`)}
                    >
                      ▶ Watch
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '10px', padding: '2px 8px' }}
                      onClick={() => navigate(`/party/create/${rec._id}`)}
                    >
                      🎉 Party
                    </button>
                </div>
                </div>
              </div>
            ))}

        </div>
      </div>
    </div>
  );
}