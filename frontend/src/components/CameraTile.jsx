import React, { useEffect, useRef, useState } from 'react';

const COLORS = ['#b71c1c','#1a237e','#1b5e20','#4a148c','#e65100','#006064'];
const getColor = (username) => COLORS[(username?.charCodeAt(0) || 0) % COLORS.length];

export default function CameraTile({
  participant,
  stream,
  isSelf    = false,
  isHost    = false,   // viewer is the host (can control others)
  onMute,
  onRemove,
  camOn = true,
  micOn = true,
  onToggleCam,
  onToggleMic
}) {
  const videoRef  = useRef(null);
  const [showControls, setShowControls] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  // Recompute hasVideo whenever stream changes or tracks change state
  useEffect(() => {
    if (!stream) { setHasVideo(false); return; }
    const check = () => {
      setHasVideo(
        stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
      );
    };
    check();
    // Re-check when any track changes state (e.g. enabled → disabled)
    const tracks = stream.getVideoTracks();
    tracks.forEach(t => {
      t.addEventListener('ended', check);
      t.addEventListener('mute',  check);
      t.addEventListener('unmute', check);
    });
    return () => {
      tracks.forEach(t => {
        t.removeEventListener('ended', check);
        t.removeEventListener('mute',  check);
        t.removeEventListener('unmute', check);
      });
    };
  }, [stream]);

  // Attach / detach stream — re-run when hasVideo flips so the newly mounted
  // <video> element always has srcObject assigned.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      // Always reassign srcObject when stream reference changes.
      // For remote streams the MediaStream object is mutated (tracks added),
      // so we must re-assign to force the browser to re-bind.
      video.srcObject = stream;
      // Browsers require a user gesture for unmuted autoplay.
      // Remote tiles are never muted so we catch and ignore the rejection —
      // the user's first interaction with the page will unblock it.
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[CameraTile] autoplay blocked:', err.message);
          }
        });
      }
    } else {
      video.srcObject = null;
    }
  }, [stream, hasVideo]);

  const initials = participant?.username
    ? participant.username.slice(0, 2).toUpperCase()
    : '??';
  const color = getColor(participant?.username);

  return (
    <div
      className="camera-tile"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Video / Avatar */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <>
          {/* Hidden video still needed to keep stream attached */}
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
          <div
            className="camera-tile-avatar"
            style={{ background: color, color: '#fff', width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 600 }}
          >
            {initials}
          </div>
        </>
      )}

      {/* Name bar */}
      <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,

            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',

            padding: '5px 10px',

            borderRadius: '999px',

            background: 'rgba(0,0,0,0.6)',

            color: '#fff',
            fontSize: '12px',
          }}
        >
          <span>
            {participant?.username || 'Unknown'}
            {isSelf && ' (You)'}
            {participant?.isHost && ' 👑'}
          </span>

          {isSelf ? (

            <div
              style={{
                display: 'flex',
                gap: '8px'
              }}
            >

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCam?.();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '16px'
                }}
              >
                {camOn ? '📷' : '🚫📷'}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMic?.();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '16px'
                }}
              >
                {micOn ? '🎤' : '🔇'}
              </button>

            </div>

          ) : (

            <div
              style={{
                display: 'flex',
                gap: '8px'
              }}
            >
              {hasVideo ? '📷' : '🚫📷'}
              {participant?.audioMuted ? '🔇' : '🎤'}
            </div>

          )}
        </div>

      {/* Muted mic indicator */}
      {participant?.audioMuted && (
        <div className="camera-tile-muted">🔇</div>
      )}

      {/* Host controls — only show on hover, only for other participants */}
      {isHost && !isSelf && showControls && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onMute?.(participant._id); }}
            style={{
              background: 'rgba(0,0,0,0.75)', border: '0.5px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: '11px', borderRadius: '6px',
              padding: '5px 12px', cursor: 'pointer', width: '90px',
            }}
          >
            🔇 Mute
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove?.(participant._id); }}
            style={{
              background: 'rgba(229,57,53,0.75)', border: 'none',
              color: '#fff', fontSize: '11px', borderRadius: '6px',
              padding: '5px 12px', cursor: 'pointer', width: '90px',
            }}
          >
            ✕ Kick
          </button>
        </div>
      )}
    </div>
  );
}