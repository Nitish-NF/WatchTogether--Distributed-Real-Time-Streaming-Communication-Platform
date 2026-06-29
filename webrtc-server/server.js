require('dotenv').config();

const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const {initSignaling} = require('./src/signaling');
const mediasoupManager  = require('./src/mediasoup');
const rooms             = require('./src/rooms');

// ── Logger — use project logger if available, else console ───────
let logger;
try {
  logger = require('./src/utils/logger');
} catch {
  logger = {
    info:  (...a) => console.log('[INFO]',  ...a),
    warn:  (...a) => console.warn('[WARN]',  ...a),
    error: (...a) => console.error('[ERROR]', ...a),
  };
}

const app    = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:   'ok',
    service:  'webrtc-server',
    workers:  mediasoupManager.workerCount(),
    uptime:   process.uptime(),
  });
});

// ── RTP Capabilities (REST fallback — socket is preferred) ────────
// The client normally gets RTP caps via the socket join flow.
// This endpoint exists as a fallback for pre-loading the Device.
app.get('/rtp-capabilities/:roomId', async (req, res) => {
  try {
    const caps = await mediasoupManager.getRouterRtpCapabilities(
      req.params.roomId
    );
    res.json(caps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TURN credentials endpoint (time-limited, JWT-gated) ──────────
// Clients call this to get short-lived TURN credentials.
app.get('/turn-credentials', (req, res) => {
  try {
    const turnPath = path.join(__dirname, 'config', 'turn.json');
    if (!fs.existsSync(turnPath)) {
      return res.json({ iceServers: [] });
    }
    const turn = JSON.parse(fs.readFileSync(turnPath, 'utf8'));
    res.json({ iceServers: turn.iceServers || [] });
  } catch (err) {
    logger.error('[TURN] Failed to load credentials:', err.message);
    res.json({ iceServers: [] });
  }
});

// ── Room stats (debug / admin) ────────────────────────────────────
app.get('/rooms', (_req, res) => {
  res.json(rooms.getAllRooms());
});

// ── Boot ──────────────────────────────────────────────────────────
const PORT = process.env.WEBRTC_PORT || 4000;

(async () => {
  try {
    await mediasoupManager.initSignaling();
    logger.info('[mediasoup] Workers ready');

    initSignaling(server);
    logger.info('[Signaling] Socket.io ready');

    server.listen(PORT, () => {
      logger.info(`[WebRTC Server] Running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('[WebRTC Server] Fatal startup error:', err);
    process.exit(1);
  }
})();