import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import socket from '../sockets/socket';
import toast from 'react-hot-toast';

export default function VideoPlayer({
  src,
  isHost   = false,
  onSync,
  roomId,
  syncEvent,
  onProgress=0,
  onPauseSave=null,
  startTime=0,
  isSolo = false,
  autoPlay = false,
}) {
  const videoRef    = useRef(null);
  const hlsRef      = useRef(null);
  const hideTimer   = useRef(null);
  const isRemoteUpdate = useRef(false);
  const latestHostState = useRef(null);
  const locallypausedRef = useRef(false);
  // Stores a sync event that arrived before the video was ready to seek
  const pendingSync = useRef(null);
  const starttimeRef=useRef(startTime);

  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [volume,       setVolume]       = useState(1);
  const [synced,       setSynced]       = useState(true);
  const [quality,      setQuality]      = useState(-1); // -1 = Auto
  const [levels,       setLevels]       = useState([]);
  const [showControls, setShowControls] = useState(false);


  useEffect(()=> {
    starttimeRef.current=startTime;
  },[startTime]);

  // ── HLS init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels || []);
        if (starttimeRef.current > 0) {
          const handleSeeked = () => {
            if (autoPlay) {
              video.play().catch(() => {});
            }
            video.removeEventListener(
              "seeked",
              handleSeeked
            );
          };
          video.addEventListener(
            "seeked",
            handleSeeked
          );
          video.currentTime = starttimeRef.current;
        } else if (autoPlay) {
          video.play().catch(() => {});
        }
      });

      // FIX #7: keep quality dropdown in sync with HLS auto-switching
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (hls.autoLevelEnabled) setQuality(-1);
        else setQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) console.error('[HLS]', data.type, data.details);
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, autoPlay]);

  useEffect(() => {

    if (!isHost) return;

    const interval = setInterval(() => {

      if (!videoRef.current) return;

      socket.emit("video-state", {
        roomId,
        currentTime: videoRef.current.currentTime,
        paused: videoRef.current.paused,
      });

    }, 2000);

    return () => clearInterval(interval);

  }, [isHost, roomId]);

  useEffect(() => {

    socket.on("video-state", (state) => {
      latestHostState.current = state;
    });

    return () => {
      socket.off("video-state");
    };

  }, []);

  // ── Track playback state ──────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime     = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration);
    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);
    video.addEventListener('timeupdate',     onTime);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('play',           onPlay);
    video.addEventListener('pause',          onPause);
    return () => {
      video.removeEventListener('timeupdate',     onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
    };
  }, []);

  // FIX #2: clean up hide-timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => clearTimeout(hideTimer.current);
  }, []);

  const apply = useCallback(({ action, time }) => {
    isRemoteUpdate.current = true;
    const video = videoRef.current;
    if (!video) return;

    if (action === 'play') {
      const drift = Math.abs(video.currentTime - (time ?? 0));
      if (drift > 0.8) video.currentTime = time;

      // ✅ Only play if user hasn't manually paused locally
      if (!locallypausedRef.current) {
        video.play().catch(() => {});
        setPlaying(true);
      } else {
        // Still sync the time even if staying paused
        video.currentTime = time;
      }

    } else if (action === 'pause') {
      // ✅ Host pause overrides everyone, including locally paused guests
      video.pause();
      video.currentTime = time ?? video.currentTime;
      setPlaying(false);

    } else if (action === 'seek') {
      video.currentTime = time;
    }

    setTimeout(() => { isRemoteUpdate.current = false; }, 200);
    setSynced(true);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (pendingSync.current) {
      apply(pendingSync.current);
      pendingSync.current = null;
    }
  }, [apply]);
  
    // ── Handle incoming sync events (non-host viewers) ───────────────
  useEffect(() => {
    if (!syncEvent) return;
    const video = videoRef.current;
    if (!video) return;

    // If the video is not ready to seek yet (initial join while HLS loads),
    // store it as pending and wait for the 'canplay' event to apply it.
    if (video.readyState < 1) {
      pendingSync.current = syncEvent;
    } else {
      apply(syncEvent);
    }

  }, [syncEvent, isHost,apply]);

  // ── Playback controls ─────────────────────────────────────────────
  // All users can play/pause locally.
  // Only the host broadcasts sync events to others.
  const togglePlay = useCallback(async () => {
    if (isRemoteUpdate.current) return;
    const video = videoRef.current;
    if (!video) return;

    if (isHost || isSolo) {
      if (video.paused) {
        await video.play().catch(() => {});
        if (onSync) onSync('play', video.currentTime);
      } else {
        video.pause();
        if (onSync) onSync('pause', video.currentTime);
      }
    } else {
      if (video.paused) {
        // ✅ Block guest from playing if host is currently paused
        if (latestHostState.current?.paused) {
          toast('Waiting for host to play...');
          return;  // ❌ don't play
        }
        if (latestHostState.current) {
          video.currentTime = latestHostState.current.currentTime;
        }
        await video.play().catch(() => {});
        locallypausedRef.current = false;
      } else {
        video.pause();
        locallypausedRef.current = true;
      }
    }
  }, [isHost,isSolo, onSync]);

  const seek = useCallback((e) => {
    if (!isHost && !isSolo) return;  // ✅ allow solo watch to seek
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time  = Math.max(0, Math.min(ratio * duration, duration));
    video.currentTime = time;
    if (onSync) onSync('seek', time);  // onSync is undefined in solo, so this is safe
  }, [duration, isHost, isSolo, onSync]);

  // FIX #4 & #5: keep video.muted, video.volume, and React state all in sync
  const changeVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted  = v === 0;   // FIX #4: actually unmute the element
      setMuted(v === 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nowMuted = !video.muted;
    video.muted = nowMuted;
    setMuted(nowMuted);
    // FIX #5: restore volume when unmuting so the slider reflects reality
    if (!nowMuted && video.volume === 0) {
      video.volume = 1;
      setVolume(1);
    }
  };

  const toggleFullscreen = () => {
    const wrapper = videoRef.current?.parentElement;
    if (!wrapper) return;
    if (!document.fullscreenElement) wrapper.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const changeQuality = (e) => {
    const idx = parseInt(e.target.value, 10);
    setQuality(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx; // -1 = auto
  };

  // ── Auto-hide controls ─────────────────────────────────────────────
  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  // FIX #6: show '--:--' until metadata is loaded, not '0:00'
  const fmt = (s) => {
    if (!s || isNaN(s)) return '--:--';
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="video-player-wrapper"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      style={{
        position: 'relative', width: '100%', aspectRatio: '16/9',
        background: '#000', borderRadius: '16px', overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          if (onProgress) {
            onProgress?.(e.target.currentTime);
          }
        }}
        onPause={() => {
          onPauseSave?.();
        }}
      />

      {/* Sync badge — shown to non-hosts only */}
      {!isHost && onSync && (
        <div
          className="sync-indicator"
          style={{ color: synced ? '#4caf50' : '#ff9800' }}
        >
          {synced ? <><span className="sync-dot" /> Synced</> : '⚠ Out of sync'}
        </div>
      )}

      {/* Host badge */}
      {isHost && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.3)',
          borderRadius: '99px', padding: '3px 10px', fontSize: '11px', color: '#ffd54f',
        }}>
          👑 HOST
        </div>
      )}

      {/* Controls */}
      <div
        className="player-controls-bar"
        style={{ opacity: showControls || !playing ? 1 : 0 }}
      >
        {/* Progress */}
        <div
          className="progress-track"
          onClick={isHost || isSolo ? seek : undefined}   // ✅
          style={{ cursor: isHost || isSolo ? 'pointer' : 'default' }}  // ✅
        >
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Row */}
        <div className="controls-row">
          <button
            className="ctrl-btn"
            onClick={togglePlay}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <button className="ctrl-btn" onClick={toggleMute}>
            {muted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
          </button>

          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={changeVolume}
            style={{ width: '70px', accentColor: 'var(--red)', cursor: 'pointer' }}
          />

          <span className="ctrl-time">{fmt(currentTime)} / {fmt(duration)}</span>
          <span className="ctrl-spacer" />

          {/* Quality selector */}
          <select value={quality} onChange={changeQuality} className="ctrl-quality">
            <option value={-1}>Auto</option>
            {levels.map((lvl, i) => (
              <option key={i} value={i}>
                {lvl.height ? `${lvl.height}p` : `Level ${i + 1}`}
              </option>
            ))}
          </select>

          <button className="ctrl-btn" onClick={toggleFullscreen} style={{ fontSize: '14px' }}>
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}