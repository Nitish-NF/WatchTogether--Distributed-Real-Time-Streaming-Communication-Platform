const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt.js');   // ← access token only
const User = require('../modules/users/user.model.js');
const partyService         = require('../modules/watchparty/party.service.js');
const syncService          = require('../modules/sync/sync.service.js');
const notificationService  = require('../modules/notifications/notification.service.js');
const conversationService  = require('../modules/conversations/conversation.service.js');
const logger               = require('../utils/logger.js');
const socketStore = require('./socketStore');
let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['polling', 'websocket'],
  });
  socketStore.setIO(io);
  notificationService.setIo(io);

  // ── Auth middleware ───────────────────────────────────────────────
  // The client passes its in-memory access token in socket.handshake.auth.token.
  // The HttpOnly refresh cookie is NOT sent here (no credentials needed for WS).
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('No token'));

      const decoded = verifyAccessToken(token);   // 15-min access token
      const user    = await User.findById(decoded.id).select('-password -refreshTokens');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`[Socket] ${user.username} connected (${socket.id})`);

    socket.join(`user:${user._id}`);

    socket.on('join_user_room', ({ userId }) => {
      if (userId?.toString() === user._id.toString()) {
        socket.join(`user:${user._id}`);
      }
    });

    // ── Watch Party Room ────────────────────────────────────────────
    socket.on('join_room', async ({ roomId }) => {
      try {
        const room   = await partyService.getRoom(roomId);
        const hostId = room.hostId?._id || room.hostId;

        if (hostId.toString() === user._id.toString()) {
          await partyService.markHostReconnected(roomId);
        }

        // addParticipant enforces private-room invitation rules and throws
        // (statusCode 403) if this user has no participant record on a
        // private room, or was previously kicked. We only join the socket
        // room / mark them present once that succeeds.
        const updatedRoom = await partyService.addParticipant(roomId, user);
        socket.join(roomId);

        if (room.conversationId) {
          socket.join(`conversation:${room.conversationId}`);
          socket.partyConversationId = room.conversationId.toString();
        }

        socket.emit('sync_event', room.syncState);
        socket.emit('room_state', { participants: updatedRoom.participants });
        socket.to(roomId).emit('user_joined', {
          participant: { _id: user._id, username: user.username },
        });

        if (hostId?.toString() !== user._id.toString()) {
          await notificationService.create({
            userId:   hostId,
            type:     'join_alert',
            fromUser: user._id,
            roomId,
            message:  `${user.username} joined your watch party.`,
          });
        }

        logger.info(`[Room] ${user.username} joined room ${roomId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
        logger.warn(`[Room] Join failed: ${err.message}`);
      }
    });

    socket.on('leave_room', async ({ roomId }) => {
      socket.leave(roomId);
      // Marks the participant absent (isPresent=false) but keeps their
      // record so they're recognized as "already invited/joined" on return.
      await partyService.removeParticipant(roomId, user._id);
      socket.to(roomId).emit('user_left', { userId: user._id });
      logger.info(`[Room] ${user.username} left room ${roomId}`);
    });

    // ── Video Sync ──────────────────────────────────────────────────
    socket.on('sync_event', async (data) => {
      await syncService.handleSyncEvent(io, socket, data);
    });

    socket.on('video-state', (data) => {
      socket.to(data.roomId).emit('video-state', data);
    });

    // ── Watch Party Chat ────────────────────────────────────────────
    socket.on('chat_message', async ({ roomId, message }) => {
      const msg = {
        ...message,
        userId:    user._id,
        username:  user.username,
        timestamp: new Date(),
      };
      socket.to(roomId).emit('chat_message', msg);

      const conversationId = socket.partyConversationId;
      if (conversationId) {
        try {
          await conversationService.sendMessage({
            conversationId,
            senderId:       user._id,
            senderUsername: user.username,
            type:           'text',
            text:           message.text,
          });
        } catch (err) {
          logger.warn(`[Chat] Failed to persist party message: ${err.message}`);
        }
      }
    });

    // ── Direct Message Conversations ────────────────────────────────
    socket.on('join_conversation',  ({ conversationId }) => socket.join(`conversation:${conversationId}`));
    socket.on('leave_conversation', ({ conversationId }) => socket.leave(`conversation:${conversationId}`));

    socket.on('conversation_message', ({ conversationId, message }) => {
      socket.to(`conversation:${conversationId}`).emit('conversation_message', {
        ...message,
        senderId:  user._id,
        username:  user.username,
        timestamp: new Date(),
      });
    });

    socket.on('typing', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing', {
        userId:   user._id,
        username: user.username,
      });
    });

    // ── Host Controls ───────────────────────────────────────────────
    socket.on('mute_user', ({ roomId, targetId }) => {
      io.to(`user:${targetId}`).emit('user_muted', { userId: targetId });
      io.to(roomId).emit('user_muted', { userId: targetId });
    });

    socket.on('kick_user', async ({ roomId, targetId }) => {
      // kickParticipant sets isKicked=true (not just isPresent=false) so the
      // user can no longer rejoin the room, unlike a normal leave/disconnect.
      await partyService.kickParticipant(roomId, targetId);
      io.to(`user:${targetId}`).emit('kicked', { roomId });
      io.to(roomId).emit('user_left', { userId: targetId });
    });

    socket.on('lock_room', async ({ roomId }) => {
      try {
        await partyService.toggleLock(roomId, user._id);
        io.to(roomId).emit('room_locked', { lockedBy: user.username });
      } catch {}
    });

    socket.on('party_ended', ({ roomId }) => {
      io.to(roomId).emit('party_ended', { roomId });
    });

    // ── Friend watching status ───────────────────────────────────────
    socket.on('watching_status', ({ movieId, movieTitle }) => {
      socket.broadcast.emit('friend_watching', {
        userId: user._id, username: user.username, movieId, movieTitle,
      });
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on('disconnecting', async () => {
      for (const room of socket.rooms) {
        if (room === socket.id || room === `user:${user._id}`) continue;
        if (room.startsWith('conversation:')) continue;
        // Marks isPresent=false; the participant record is kept so a
        // reconnect is recognized as the same invited/returning user.
        await partyService.removeParticipant(room, user._id).catch(() => {});
        socket.to(room).emit('user_left', { userId: user._id });
      }
    });

    socket.on('disconnect', async () => {
      try {
        await partyService.markHostDisconnected(user._id);
        logger.info(`[Socket] ${user.username} disconnected`);
      } catch (err) {
        logger.error(`[Socket] Disconnect error: ${err.message}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

module.exports = { initSocket, getIO };