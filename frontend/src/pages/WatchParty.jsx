import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as mediasoupClient from 'mediasoup-client';

import VideoPlayer  from '../components/VideoPlayer';
import CameraTile   from '../components/CameraTile';
import ChatBox      from '../components/ChatBox';
import { useAuth }  from '../context/AuthContext';
import socket       from '../sockets/socket';
import { webrtcSocket, connectWebRTC, disconnectWebRTC } from '../sockets/webrtcSocket';
import { createSendTransport, createRecvTransport, startProducing, consumeFromPeer } from '../webrtc/mediasoupClient';

import conversationService from '../services/conversationService';
import toast               from 'react-hot-toast';
import { formatStreamUrl } from '../utils/media';
import partyService        from '../services/partyService';
import { HiArrowLeftOnRectangle } from 'react-icons/hi2';
import { TbPlaystationX }         from 'react-icons/tb';
import { FaLink }                 from 'react-icons/fa6';

// ─── Audio level hook (speaking glow) ────────────────────────────────────────
function useAudioLevel(stream, enabled = true, threshold = 18) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!enabled || !stream) return;
    const tracks = stream.getAudioTracks();
    if (!tracks.length) return;
    let active = true;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!active) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setIsSpeaking(avg > threshold);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {}
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, [stream, enabled, threshold]);

  return isSpeaking;
}

// ─── Smart cam tile with speaking glow ───────────────────────────────────────
function SmartCamTile({ stream, isSelf, participant, isHost, camOn, micOn,
                        onToggleCam, onToggleMic, onMute, onRemove, className = '' }) {
  const isSpeaking = useAudioLevel(stream, !isSelf);
  return (
    <div className={`party-cam-tile${isSpeaking ? ' speaking' : ''}${className ? ' ' + className : ''}`}>
      <CameraTile
        participant={participant}
        stream={stream}
        isSelf={isSelf}
        isHost={isHost}
        camOn={camOn}
        micOn={micOn}
        onToggleCam={onToggleCam}
        onToggleMic={onToggleMic}
        onMute={onMute}
        onRemove={onRemove}
      />
    </div>
  );
}

function normalizeDbMessage(msg) {
  return {
    ...msg,
    userId:    msg.senderId       ?? msg.userId,
    username:  msg.senderUsername ?? msg.username,
    timestamp: msg.createdAt      ?? msg.timestamp,
  };
}

// ─── Hook: is desktop? (≥ 1024px) ────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export default function WatchParty() {
  const { roomId } = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const isDesktop  = useIsDesktop();

  // ── UI STATE ──────────────────────────────────────────────
  const [room,             setRoom]             = useState(null);
  const [participants,     setParticipants]     = useState([]);
  const [messages,         setMessages]         = useState([]);
  const [syncEvent,        setSyncEvent]        = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [chatOpen,         setChatOpen]         = useState(true);
  const [camOn,            setCamOn]            = useState(false);
  const [micOn,            setMicOn]            = useState(false);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [resumeTime,       setResumeTime]       = useState(0);
  const [remoteStreams,    setRemoteStreams]     = useState({});
  // FIX: renamed from savedAction to avoid shadowing the state variable in init()
  const [savedSyncAction,  setSavedSyncAction]  = useState('pause');
  const [unreadChat,       setUnreadChat]       = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isLocked,         setIsLocked]         = useState(false);
  const [camColumnOpen,    setCamColumnOpen]     = useState(false);
  const [camStripOpen,     setCamStripOpen]     = useState(true);

  // ── REFS ──────────────────────────────────────────────────
  const deviceRef          = useRef(null);
  const sendTransportRef   = useRef(null);
  const recvTransportRef   = useRef(null);
  const producersRef       = useRef({ video: null, audio: null });
  const consumersRef       = useRef({});
  const consumerToPeerRef  = useRef({});
  const localStreamRef     = useRef(null);
  const joinedRef          = useRef(false);
  const progressRef        = useRef(0);
  const actionRef          = useRef('pause');
  const isRemoteUpdate     = useRef(false);
  const consumeProducerRef = useRef(null);
  const conversationIdRef  = useRef(null);
  const chatOpenRef        = useRef(false);

  const hostId = room?.hostId?._id ?? room?.hostId;
  const isHost = hostId?.toString() === user?._id?.toString();

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // ── CHAT HELPERS ──────────────────────────────────────────
  const handleNewMessage = useCallback((msg) => {
    // FIX: ignore messages echoed back from the server for the current user
    // to prevent double-display and incorrect unread counts
    if (msg.userId?.toString() === user?._id?.toString()) return;
    setMessages(prev => [...prev, msg]);
    if (!chatOpenRef.current) setUnreadChat(c => c + 1);
  }, [user?._id]);

  const toggleChat = useCallback(() => {
    setChatOpen(prev => {
      if (!prev) setUnreadChat(0);
      return !prev;
    });
  }, []);

  // ── SAVE PROGRESS ─────────────────────────────────────────
  const saveCurrentProgress = useCallback(() => {
    if (!isHost || progressRef.current <= 5) return;
    partyService.saveSyncState(roomId, { action: actionRef.current, time: progressRef.current })
      .catch(console.error);
  }, [isHost, roomId]);

  useEffect(() => {
    if (!room) return;
    const interval = setInterval(saveCurrentProgress, 2_000);
    return () => { clearInterval(interval); saveCurrentProgress(); };
  }, [room, saveCurrentProgress]);

  useEffect(() => {
    window.addEventListener('beforeunload', saveCurrentProgress);
    return () => window.removeEventListener('beforeunload', saveCurrentProgress);
  }, [saveCurrentProgress]);

  // ── INIT ──────────────────────────────────────────────────
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStreamState(stream);
        setCamOn(true);
        setMicOn(true);
      } catch (err) {
        console.warn('[WatchParty] camera/mic unavailable:', err.message);
        toast.error('Camera/mic unavailable');
      }

      let data;
      try {
        data = await partyService.getRoom(roomId);
        data.streamUrl = formatStreamUrl(data.streamUrl);
        setRoom(data);
        setParticipants(data.participants || []);
        setIsLocked(data.isLocked || false);
        const initialTime   = data.syncState?.time   || 0;
        // FIX: renamed local variable so it no longer shadows the setSavedSyncAction setter
        const initialAction = data.syncState?.action || 'pause';
        setSavedSyncAction(initialAction);
        setResumeTime(initialTime);

        // FIX: seed actionRef from saved state so saveCurrentProgress writes
        // the correct action even before the first handleSync call
        actionRef.current = initialAction;

        const isHostNow =
          data.hostId?._id?.toString() === user._id?.toString() ||
          data.hostId?.toString()      === user._id?.toString();

        if (isHostNow) {
          socket.emit('sync_event', { roomId, event: { action: initialAction, time: initialTime } });
        } else {
          setSyncEvent({ action: initialAction, time: initialTime, receivedAt: Date.now() });
        }
      } catch {
        toast.error('Room not found');
        navigate('/');
        return;
      }

      if (data.conversationId) {
        conversationIdRef.current = data.conversationId.toString();
        try {
          const history = await conversationService.getMessages(data.conversationId);
          if (history?.length) setMessages(history.map(normalizeDbMessage));
        } catch (err) {
          console.warn('[WatchParty] Could not load chat history:', err.message);
        }
      }

      setLoading(false);
      socket.emit('join_room', { roomId });
      connectWebRTC();

      webrtcSocket.emit(
        'joinRoom',
        { roomId, userId: user._id, username: user.username },
        async ({ rtpCapabilities, error }) => {
          if (error) { console.error('[WatchParty] joinRoom error:', error); return; }
          try {
            const device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: rtpCapabilities });
            deviceRef.current = device;

            const [sendTransport, recvTransport] = await Promise.all([
              createSendTransport(device, roomId),
              createRecvTransport(device, roomId),
            ]);
            sendTransportRef.current = sendTransport;
            recvTransportRef.current = recvTransport;

            const producers = await startProducing(sendTransport, device, localStreamRef.current);
            producersRef.current = producers;

            webrtcSocket.emit('getProducers', { roomId }, (existingProducers) => {
              existingProducers.forEach(({ producerId, socketId: peerSocketId, username: peerUsername }) => {
                // FIX: added null-check guard in case ref isn't assigned yet
                consumeProducerRef.current?.({ producerId, peerSocketId, username: peerUsername });
              });
            });
          } catch (err) {
            console.error('[WatchParty] mediasoup init error:', err);
            toast.error('mediasoup init failed');
          }
        }
      );
    }

    init();

    return () => {
      // FIX: corrected teardown order — stop tracks first, then close transports,
      // then disconnect WebRTC socket, then leave rooms.
      // Previously transports were closed before disconnectWebRTC(), which meant
      // producerClosed events could not be forwarded by the server.
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      disconnectWebRTC();
      socket.emit('leave_room', { roomId });
      if (conversationIdRef.current) {
        socket.emit('leave_conversation', { conversationId: conversationIdRef.current });
      }
    };
  }, [roomId]); // eslint-disable-line

  // ── CONSUME ───────────────────────────────────────────────
  const consumeProducer = useCallback(
    async ({ producerId, peerSocketId, username: peerUsername }) => {
      const device        = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      const result = await consumeFromPeer({
        producerId, peerSocketId, peerUsername,
        roomId, device, recvTransport,
      });
      if (!result) return;

      const { consumer, track, peerKey, peerUsername: resolvedName } = result;
      consumersRef.current[consumer.id]      = consumer;
      consumerToPeerRef.current[consumer.id] = peerKey;

      setRemoteStreams(prev => {
        const existing = prev[peerKey];
        let stream;
        if (existing) {
          stream = existing.stream;
          stream.getTracks().filter(t => t.kind === track.kind).forEach(t => stream.removeTrack(t));
        } else {
          stream = new MediaStream();
        }
        stream.addTrack(track);
        return { ...prev, [peerKey]: { stream, username: existing?.username || resolvedName || 'Guest' } };
      });
    },
    [roomId]
  );

  consumeProducerRef.current = consumeProducer;

  // ── WEBRTC EVENTS ─────────────────────────────────────────
  useEffect(() => {
    const handleNewProducer = ({ producerId, socketId: peerSocketId, username: peerUsername }) => {
      consumeProducerRef.current?.({ producerId, peerSocketId, username: peerUsername });
    };
    const handleProducerClosed = ({ producerId }) => {
      const entry = Object.entries(consumersRef.current).find(([, c]) => c.producerId === producerId);
      if (!entry) return;
      const [consumerId, consumer] = entry;
      const peerKey = consumerToPeerRef.current[consumerId];
      try { consumer.close(); } catch (_) {}
      delete consumersRef.current[consumerId];
      delete consumerToPeerRef.current[consumerId];
      if (!Object.values(consumerToPeerRef.current).some(k => k === peerKey)) {
        setRemoteStreams(prev => { const next = { ...prev }; delete next[peerKey]; return next; });
      }
    };
    const handlePeerLeft = ({ socketId: leftSocketId }) => {
      Object.entries(consumerToPeerRef.current).forEach(([consumerId, peerKey]) => {
        if (peerKey === leftSocketId) {
          try { consumersRef.current[consumerId]?.close(); } catch (_) {}
          delete consumersRef.current[consumerId];
          delete consumerToPeerRef.current[consumerId];
        }
      });
      setRemoteStreams(prev => { const next = { ...prev }; delete next[leftSocketId]; return next; });
    };

    webrtcSocket.on('newProducer',    handleNewProducer);
    webrtcSocket.on('producerClosed', handleProducerClosed);
    webrtcSocket.on('peer_left',      handlePeerLeft);
    return () => {
      webrtcSocket.off('newProducer',    handleNewProducer);
      webrtcSocket.off('producerClosed', handleProducerClosed);
      webrtcSocket.off('peer_left',      handlePeerLeft);
    };
  }, [consumeProducer]);

  // ── SOCKET EVENTS ─────────────────────────────────────────
  useEffect(() => {
    const handleSyncEvent  = (event) => setSyncEvent(event ? { ...event, receivedAt: Date.now() } : null);
    const handleUserJoined = ({ participant }) =>
      setParticipants(prev =>
        prev.find(p => p._id?.toString() === participant._id?.toString())
          ? prev : [...prev, participant]
      );
    const handleUserLeft  = ({ userId }) =>
      setParticipants(prev => prev.filter(p => p._id?.toString() !== userId?.toString()));
    const handleKicked    = ({ roomId: kickedRoom }) => {
      if (kickedRoom === roomId) { toast.error('You have been removed from the party.'); navigate('/'); }
    };
    const handleUserMuted = ({ userId: mutedId }) => {
      if (isRemoteUpdate.current) return;
      if (mutedId?.toString() === user?._id?.toString()) {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = false; setMicOn(false); }
        toast('You were muted by the host.');
      }
    };

    socket.on('chat_message', handleNewMessage);
    socket.on('sync_event',   handleSyncEvent);
    socket.on('user_joined',  handleUserJoined);
    socket.on('user_left',    handleUserLeft);
    socket.on('kicked',       handleKicked);
    socket.on('user_muted',   handleUserMuted);
    return () => {
      socket.off('chat_message', handleNewMessage);
      socket.off('sync_event',   handleSyncEvent);
      socket.off('user_joined',  handleUserJoined);
      socket.off('user_left',    handleUserLeft);
      socket.off('kicked',       handleKicked);
      socket.off('user_muted',   handleUserMuted);
    };
  }, [roomId, user?._id, navigate, handleNewMessage]);

  useEffect(() => {
    const handlePartyEnded = ({ roomId: endedRoom }) => {
      if (endedRoom !== roomId) return;
      toast.error('Host ended the party');
      navigate('/home');
    };
    socket.on('party_ended', handlePartyEnded);
    return () => socket.off('party_ended', handlePartyEnded);
  }, [roomId, navigate]);

  // ── CONTROLS ──────────────────────────────────────────────
  const handleSend = (text) => {
    const msg = { userId: user._id, username: user.username, text, timestamp: new Date() };
    // FIX: add to local state immediately for the sender's own view,
    // and emit to others — server should NOT echo back to sender to avoid duplicates
    setMessages(prev => [...prev, msg]);
    socket.emit('chat_message', { roomId, message: msg });
  };

  const handleMuteUser   = (targetId) => socket.emit('mute_user', { roomId, targetId });
  const handleKickUser   = (targetId) => socket.emit('kick_user', { roomId, targetId });

  // FIX: handleToggleLock now waits for server confirmation before updating
  // local state, preventing UI/server desync on failure
  const handleToggleLock = async () => {
    try {
      await partyService.toggleLock(roomId);
      setIsLocked(prev => {
        const next = !prev;
        socket.emit('lock_room', { roomId });
        toast.success(next ? 'Room locked' : 'Room unlocked');
        return next;
      });
    } catch { toast.error('Failed to toggle lock'); }
  };

  // FIX: handleExit now only emits party_ended AFTER the API call succeeds,
  // and relies on the server to broadcast it to avoid premature disconnects
  const handleExit = async () => {
    try {
      if (isHost) {
        await partyService.closeRoom(roomId);
        // Server should emit party_ended to all room members; we emit as a
        // belt-and-suspenders fallback only after the API call confirms success
        socket.emit('party_ended', { roomId });
      }
      navigate('/home');
    } catch (err) {
      console.error(err);
      toast.error('Failed to close room');
    }
  };

  const handleSync = useCallback((action, time) => {
    if (!isHost) return;
    actionRef.current = action;
    partyService.saveSyncState(roomId, { action, time }).catch(console.error);
    socket.emit('sync_event', { roomId, event: { action, time } });
  }, [roomId, isHost]);

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const participantCount  = participants.length;
  // hostParticipant: prefer from participants list, but always fall back to
  // current user object so the host tile is NEVER missing on their own screen.
  const hostParticipantFromList = participants.find(p => p._id?.toString() === hostId?.toString());
  const hostParticipant = hostParticipantFromList
    ?? (isHost ? { ...user, isHost: true } : null);

  const otherParticipants   = participants.filter(p => p._id?.toString() !== hostId?.toString());
  const orderedParticipants = hostParticipant ? [hostParticipant, ...otherParticipants] : otherParticipants;

  // ── Shared: build ordered cam tiles (host first) ──────────
  const buildCamTiles = (extraClass = '') => {
    const tiles = [];

    // 1. Host tile — always rendered, even when hostParticipant came from fallback
    if (hostParticipant) {
      const hid    = hostParticipant._id?.toString();
      // isMe: true when current user IS the host
      const isMe   = isHost || hid === user?._id?.toString();
      // stream: self stream when isMe, otherwise look up remote stream by username
      const remote = !isMe
        ? Object.entries(remoteStreams).find(([, v]) => v.username === hostParticipant.username)
        : null;
      const stream = isMe ? localStreamState : (remote?.[1]?.stream || null);

      tiles.push(
        <SmartCamTile
          key={'host-' + (hid || 'host')}
          participant={{ ...hostParticipant, isHost: true }}
          stream={stream}
          isSelf={isMe}
          isHost={isHost}
          camOn={isMe ? camOn : undefined}
          micOn={isMe ? micOn : undefined}
          onToggleCam={isMe ? toggleCam  : undefined}
          onToggleMic={isMe ? toggleMic  : undefined}
          onMute={handleMuteUser}
          onRemove={handleKickUser}
          className={extraClass}
        />
      );
    }

    // 2. Self tile — only when current user is NOT the host
    if (!isHost) {
      tiles.push(
        <SmartCamTile
          key={'self-' + user._id}
          participant={user}
          stream={localStreamState}
          isSelf
          isHost={false}
          camOn={camOn}
          micOn={micOn}
          onToggleCam={toggleCam}
          onToggleMic={toggleMic}
          className={extraClass}
        />
      );
    }

    // 3. All other remote peers (skip the host's stream, already shown above)
    Object.entries(remoteStreams)
      .filter(([, { username }]) => username !== hostParticipant?.username)
      .forEach(([peerKey, { stream, username: peerUsername }]) => {
        const peerParticipant =
          participants.find(p => p.username === peerUsername) ||
          { username: peerUsername || 'Guest' };
        tiles.push(
          <SmartCamTile
            key={peerKey}
            participant={peerParticipant}
            stream={stream}
            isSelf={false}
            isHost={isHost}
            onMute={handleMuteUser}
            onRemove={handleKickUser}
            className={extraClass}
          />
        );
      });

    return tiles;
  };

  // ── Shared: toolbar ───────────────────────────────────────
  const toolbar = (
    <div className="party-toolbar">
      <div className="party-toolbar-left">
        <button className="btn btn-ghost btn-sm" onClick={handleExit}>
          {isHost
            ? <><TbPlaystationX /><span className="party-btn-label"> End Party</span></>
            : <><HiArrowLeftOnRectangle /><span className="party-btn-label"> Exit</span></>
          }
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
        >
          <FaLink /><span className="party-btn-label"> Copy Link</span>
        </button>
      </div>

      <div className="party-toolbar-center">
        <span className="party-room-title">
          {room?.roomName || room?.name || 'Watch Party'}
          {isLocked && <span style={{ fontSize: '11px', marginLeft: 4 }}>🔒</span>}
        </span>
        <div className="party-room-meta">
          <span className="party-meta-item">👥 {participantCount}</span>
          {room?.movieTitle && <span className="party-meta-item">{room.movieTitle}</span>}
        </div>
      </div>

      <div className="party-toolbar-right">
        <button
          className={`btn btn-ghost btn-sm${showParticipants ? ' btn-active' : ''}`}
          onClick={() => setShowParticipants(p => !p)}
          title="Participants"
        >
          👥<span className="party-btn-label"> {participantCount}</span>
        </button>

        {isHost && (
          <button
            className={`btn btn-ghost btn-sm${isLocked ? ' btn-lock-active' : ''}`}
            onClick={handleToggleLock}
            title={isLocked ? 'Unlock room' : 'Lock room'}
          >
            {isLocked ? '🔒' : '🔓'}
            <span className="party-btn-label">{isLocked ? ' Locked' : ' Lock'}</span>
          </button>
        )}

        <button
          className={`btn btn-ghost btn-sm${camStripOpen ? ' btn-active' : ''}`}
          onClick={() => {camColumnOpen ? setCamColumnOpen(v=> !v) : setCamStripOpen(v => !v)}}
          title="Toggle cameras"
        >
          📷<span className="party-btn-label"> Cams</span>
        </button>

        <button className="btn btn-ghost btn-sm" onClick={toggleChat}>
          💬<span className="party-btn-label"> {chatOpen ? 'Close Chat' : 'Chat'}</span>
          {!chatOpen && unreadChat > 0 && (
            <span className="party-unread-badge">{unreadChat > 99 ? '99+' : unreadChat}</span>
          )}
        </button>
      </div>
    </div>
  );

  // ── Shared: participants panel ────────────────────────────
  const participantsPanel = showParticipants && (
    <div className="party-participants-panel">
      <div className="party-participants-header">
        <span>👥 Participants ({participantCount})</span>
        <button
          onClick={() => setShowParticipants(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '16px' }}
        >✕</button>
      </div>
      <div className="party-participants-list">
        {orderedParticipants.map(p => {
          const pid    = p._id?.toString();
          const isMe   = pid === user?._id?.toString();
          const pIsHost = pid === hostId?.toString();
          return (
            <div key={pid} className="party-participant-row">
              <div
                className="party-participant-avatar"
                style={{ background: ['#b71c1c','#1a237e','#1b5e20','#4a148c','#e65100'][(p.username?.charCodeAt(0) || 0) % 5] }}
              >
                {p.username?.slice(0, 2).toUpperCase()}
              </div>
              <span className="party-participant-name">{p.username}</span>
              {isMe    && <span className="party-participant-you">you</span>}
              {pIsHost && <span className="party-participant-host">👑</span>}
              {isHost && !isMe && (
                <div className="party-participant-actions">
                  <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => handleMuteUser(pid)}>🔇</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--red)' }} onClick={() => handleKickUser(pid)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── VideoPlayer element ───────────────────────────────────
  const videoPlayer = (
    <VideoPlayer
      src={room?.streamUrl}
      isHost={isHost}
      roomId={roomId}
      onSync={handleSync}
      autoPlay={savedSyncAction === 'play'}
      syncEvent={syncEvent}
      startTime={isHost ? resumeTime : (syncEvent?.time || resumeTime)}
      onProgress={(time) => { if (isHost) progressRef.current = time; }}
      onPauseSave={isHost ? saveCurrentProgress : undefined}
    />
  );

  // ════════════════════════════════════════════════════════════
  //  DESKTOP LAYOUT  (≥ 1024px)
  //  ┌──────────────────────────────────────────────────────┐
  //  │                    toolbar                           │
  //  ├─────────────────────────────────┬────────────────────┤
  //  │                                 │  chat  OR          │
  //  │           screen                │  cam grid (2-col)  │
  //  │                                 │                    │
  //  └─────────────────────────────────┴────────────────────┘
  //
  //  DESKTOP LAYOUT
  //  ┌──────────────────────────────────────────────────────┐
  //  │                    toolbar                           │
  //  ├─────────────────────────────────┬────────────────────┤
  //  │                                 │  chat panel  (OR)  │
  //  │           screen                │  cam grid          │
  //  │                                 │  (chat closed only)│
  //  ├─────────────────────────────────┴────────────────────┤
  //  │  cam strip (always visible when camStripOpen)        │
  //  └──────────────────────────────────────────────────────┘
  //
  //  The bottom strip and the right-panel cam-grid use SEPARATE
  //  buildCamTiles() calls BUT they are never both visible at the same
  //  time for the same tiles:
  //   - cam-grid is shown only when chat is CLOSED
  //   - strip is always shown (provides cam visibility when chat is open)
  //  This avoids the original duplicate-video bug while ensuring cams
  //  are never hidden when the user opens chat.
  // ════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div className="party-page">
        <div className="party-desktop">

          {/* ── Toolbar (full width) ──────────────────────── */}
          {toolbar}
          {participantsPanel}

          {/* ── Middle row: screen + right panel ─────────── */}
          <div className="party-desktop-middle">

            {/* Screen */}
            <div className="party-video-wrap">
              {videoPlayer}
            </div>

            {/* Right panel: chat takes priority; cam-grid only when chat is closed */}
            {chatOpen ? (
              <div className="party-desktop-chat">
                <ChatBox messages={messages} onSend={handleSend} />
              </div>
            ) : !camStripOpen && camColumnOpen ? (
              <div className="party-desktop-camgrid">
                {buildCamTiles('grid-tile')}
              </div>
            ) : null}
          </div>

          {/* ── Bottom strip — always rendered when camStripOpen ──
               This is the only place tiles are rendered when chat is open,
               so there is no duplication with the cam-grid above.        */}
          {camStripOpen && (
            <div className="party-camera-strip party-camera-strip--desktop">
              {buildCamTiles('strip-tile')}
              <button
                className="party-strip-close"
                onClick={() => setCamStripOpen(false)}
                title="Hide cameras"
              >✕</button>
            </div>
          )}

          {/* Re-show cams FAB when hidden */}
          {!camStripOpen && !camColumnOpen &&(
            <button className="party-strip-fab" onClick={() => setCamStripOpen(true)}>
              📷 Show Cams
            </button>
          )}

        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  MOBILE / TABLET LAYOUT  (< 1024px)
  //  Single vertical column:
  //  toolbar → participants → screen → cam strip → chatbox
  // ════════════════════════════════════════════════════════════
  return (
    <div className="party-page">
      <div className="party-col">

        {toolbar}
        {participantsPanel}

        {/* Video */}
        <div className="party-video-wrap">
          {videoPlayer}
        </div>

        {/* Camera strip */}
        {camStripOpen && (
          <div className="party-camera-strip">
            {buildCamTiles()}
            <button
              className="party-strip-close"
              onClick={() => setCamStripOpen(false)}
              title="Hide cameras"
            >✕</button>
          </div>
        )}

        {!camStripOpen && (
          <button className="party-strip-fab party-strip-fab--inline" onClick={() => setCamStripOpen(true)}>
            📷 Show Cams
          </button>
        )}

        {/* Inline collapsible chatbox */}
        <div className={`party-chatbox-inline${chatOpen ? ' party-chatbox-inline--open' : ''}`}>
          <ChatBox messages={messages} onSend={handleSend} />
        </div>

      </div>
    </div>
  );
}