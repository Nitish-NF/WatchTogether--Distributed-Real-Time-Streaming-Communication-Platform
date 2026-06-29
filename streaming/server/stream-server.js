require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

const app  = express();
const PORT = process.env.STREAM_PORT || 8080;
const HLS_DIR = path.join(__dirname, '../output');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
}));

// ── Token-based stream auth ───────────────────────────────
/*const verifyStreamToken = (req, res, next) => {
  const token = req.query.token || req.headers['x-stream-token'];
  if (!token) return res.status(401).json({ error: 'Stream token required' });

  // In production: verify JWT issued by backend
  // For now: basic check
  if (token !== process.env.STREAM_SECRET && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Invalid stream token' });
  }
  next();
};*/

const verifyStreamToken = (req, res, next) => {

  // Allow all streams in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const token =
    req.query.token ||
    req.headers['x-stream-token'];

  if (!token) {
    return res.status(401).json({
      error: 'Stream token required'
    });
  }

  if (token !== process.env.STREAM_SECRET) {
    return res.status(403).json({
      error: 'Invalid stream token'
    });
  }

  next();
};

// ── Serve thumbnails ─────────────────────────────
app.use(
  "/thumbnails",
  express.static(path.join(__dirname, "../thumbnails"))
);
// ── Serve HLS files ───────────────────────────────────────
app.use('/hls', verifyStreamToken, (req, res, next) => {
  // Set correct MIME types
  const ext = path.extname(req.path);
  if (ext === '.m3u8') {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (ext === '.ts') {
    res.setHeader('Content-Type', 'video/mp2t');
  }

  // Cache .ts segments aggressively, don't cache playlists
  if (ext === '.ts') {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  next();
}, express.static(HLS_DIR, { index: false }));

// ── List available movies ─────────────────────────────────
app.get('/movies', (req, res) => {
  if (!fs.existsSync(HLS_DIR)) return res.json([]);
  const dirs = fs.readdirSync(HLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      streamUrl: `/hls/${d.name}/index.m3u8`,
    }));
  res.json(dirs);
});

// ── Upload endpoint (accepts raw video, triggers FFmpeg) ──
app.post('/upload', verifyStreamToken, express.raw({ type: '*/*', limit: '10gb' }), async (req, res) => {
  // Sanitize name: strip path separators and allow only safe characters
  const rawName = req.query.name || '';
  const name = require('path').basename(rawName).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!name) return res.status(400).json({ error: 'name query param required' });

  const uploadPath = path.join(__dirname, '../uploads', `${name}.mp4`);

  try {
    // Async write so the event loop is not blocked
    await require('fs').promises.writeFile(uploadPath, req.body);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save upload', detail: err.message });
  }

  // Trigger conversion asynchronously
  const { exec } = require('child_process');
  exec(
    `bash ${path.join(__dirname, '../ffmpeg/convert.sh')} "${uploadPath}" "${name}"`,
    (err, stdout, stderr) => {
      if (err) console.error('[FFmpeg] Error:', stderr);
      else console.log('[FFmpeg] Done:', stdout);
    }
  );

  res.json({ message: 'Upload received, conversion started', name });
});

// ── Health ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'stream-server' }));

app.listen(PORT, () => console.log(`[Stream Server] Running on port ${PORT}`));