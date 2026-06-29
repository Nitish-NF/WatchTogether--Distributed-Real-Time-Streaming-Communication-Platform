import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || process.env.REACT_APP_SOCKET_URL
  || 'http://localhost:5000';

// ── Shared constants ───────────────────────────────────────────────
/**
 * Re-reads the token on every (re)connect so a refreshed token is always used.
 * CHANGED: reads from window.__wt_access_token__ (set by AuthContext.applyToken)
 * instead of localStorage — access token is now stored in memory only.
 */
const getAuthCb = (cb) => cb({ token: window.__wt_access_token__ ?? '' });

const MAX_RECONNECT_ATTEMPTS = 10;

export const socket = io(SOCKET_URL, {
  autoConnect:           false,
  auth:                  getAuthCb,   // function form → re-evaluated on every reconnect
  transports:            ['polling', 'websocket'],
  reconnectionAttempts:  MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay:     1000,
  reconnectionDelayMax:  8000,
  randomizationFactor:   0.4,
  timeout:               20000,
});

// ── Lifecycle logging ─────────────────────────────────────────────
socket.on('connect', () => {
  console.log('[Socket] Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.warn('[Socket] Server closed connection — possible auth expiry.');
  }
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
  if (err.message === 'No token' || err.message === 'Authentication failed') {
    console.warn('[Socket] Auth error — stopping reconnection attempts.');
    socket.io.opts.reconnectionAttempts = 0;
  }
});

socket.io.on('reconnect_failed', () => {
  console.error('[Socket] All reconnection attempts failed.');
  window.dispatchEvent(new CustomEvent('socket:connection_failed'));
});

socket.io.on('reconnect', (attemptNumber) => {
  console.log(`[Socket] Reconnected after ${attemptNumber} attempt(s)`);
  window.dispatchEvent(new CustomEvent('socket:reconnected'));
});

socket.io.on('reconnect_attempt', (n) => {
  console.log(`[Socket] Reconnect attempt ${n}…`);
});

// ── Public helpers ────────────────────────────────────────────────

export function connectSocket() {
  if (socket.connected) return;
  socket.io.opts.reconnectionAttempts = MAX_RECONNECT_ATTEMPTS;
  socket.connect();
}

export function disconnectSocket() {
  if (socket.active) socket.disconnect();
}

/**
 * Called by api.js after a silent token refresh.
 * Disconnects and reconnects so the socket re-handshakes with the
 * fresh token — getAuthCb will read the updated window.__wt_access_token__.
 */
export function reconnectSocket() {
  if (socket.active) socket.disconnect();
  socket.io.opts.reconnectionAttempts = MAX_RECONNECT_ATTEMPTS;
  // Small tick so the disconnect event settles before reconnecting
  setTimeout(() => socket.connect(), 50);
}

export default socket;