require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis.js');
const { initSocket } = require('./websocket/socket');
const errorMiddleware = require('./middleware/error.middleware');
const logger = require('./utils/logger');
const partyService = require('./modules/watchparty/party.service.js');

// Route imports
const authRoutes         = require('./modules/auth/auth.routes');
const userRoutes         = require('./modules/users/user.routes');
const movieRoutes        = require('./modules/movies/movie.routes');
const followRoutes       = require('./modules/follow/follow.routes');
const shareRoutes        = require('./modules/share/share.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const watchPartyRoutes   = require('./modules/watchparty/party.routes');
const conversationRoutes = require('./modules/conversations/conversation.routes');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests, please try again later.' },
});

setInterval(async () => {
  try {
    const result = await partyService.closeInactiveRooms();
    if (result.modifiedCount > 0) {
      console.log(
        `[Room Cleanup] Closed ${result.modifiedCount} rooms`
      );
    }
  } catch (err) {
    console.error(
      '[Room Cleanup]',
      err.message
    );
  }
}, 60000);
app.use('/api', limiter);

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/movies',        movieRoutes);
app.use('/api/follow',        followRoutes);
app.use('/api/share',         shareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/watchparty',    watchPartyRoutes);
app.use('/api/conversations',conversationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Error Handler ───────────────────────────────────────────
app.use(errorMiddleware);

// ── Boot ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await connectRedis();
  initSocket(server);
  server.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));
})();

module.exports = { app, server };