import { io } from 'socket.io-client';

/**
 * Dedicated socket for the separate WebRTC / mediasoup signaling server
 * (default port 4000 — separate from the main app socket on 5000).
 *
 * This socket is only connected while the user is inside a watch party.
 * connectWebRTC() / disconnectWebRTC() manage the lifecycle.
 */
const WEBRTC_URL = process.env.REACT_APP_WEBRTC_URL || 'http://localhost:4000';

// ── Shared constants ───────────────────────────────────────────────
/** Re-reads the token on every (re)connect so a refreshed token is always used. */
const getAuthCb = (cb) => cb({ token: window.__wt_access_token__ ?? '' });

const MAX_RECONNECT_ATTEMPTS = 5;

export const webrtcSocket = io(WEBRTC_URL, {
  autoConnect: false,
  auth: getAuthCb,
  transports: ['polling', 'websocket'],
  reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay:    1000,
  reconnectionDelayMax: 5000,
  timeout:              20_000,
});

webrtcSocket.on('connect', () => {
  console.log('[WebRTC Socket] Connected:', webrtcSocket.id);
});

webrtcSocket.on('disconnect', (reason) => {
  console.log('[WebRTC Socket] Disconnected:', reason);
});

webrtcSocket.on('connect_error', (err) => {
  console.error('[WebRTC Socket] Error:', err.message);
});

// Signaling errors come from the WebRTC server — this is the correct socket for them
webrtcSocket.on('signaling_error', ({ message }) => {
  console.error('[WebRTC Socket] Signaling error:', message);
});

/** Connect to the WebRTC server — call when entering a watch party. */
export function connectWebRTC() {
  if (webrtcSocket.connected) return;
  // Reset attempt counter (may have been exhausted on a previous session)
  webrtcSocket.io.opts.reconnectionAttempts = MAX_RECONNECT_ATTEMPTS;
  webrtcSocket.connect();
}

/** Disconnect from the WebRTC server — call when leaving a watch party. */
export function disconnectWebRTC() {
  if (webrtcSocket.active) webrtcSocket.disconnect();
}

export default webrtcSocket;