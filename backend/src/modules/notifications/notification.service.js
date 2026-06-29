const Notification = require('./notification.model.js');

const notificationService = {

  // CHANGED: accepts optional shareId so request notifications link back
  // to the Share doc — frontend needs it to call accept/decline.
  create: async ({ userId, type, fromUser, movieId, roomId, shareId, message }) => {
    const notif = await Notification.create({
      userId,
      type,
      fromUser,
      movieId,
      roomId,
      shareId: shareId || undefined,
      message,
    });

    const io = notificationService._io;
    if (io) {
      const populated = await Notification.findById(notif._id)
        .populate('fromUser', 'username avatar');

      if (populated) {
        io.to(`user:${userId}`).emit('notification', {
          _id:      populated._id,
          type:     populated.type,
          message:  populated.message,
          fromUser: populated.fromUser,
          movieId,
          roomId,
          shareId,   // NEW — included so frontend can act on requests
          read:      false,
          createdAt: populated.createdAt,
        });
      }
    }

    return notif;
  },

  getForUser: async (userId, limit = 30) => {
    return Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('fromUser', 'username avatar')
      .lean();
  },

  markRead: async (notifId, userId) => {
    return Notification.findOneAndUpdate(
      { _id: notifId, userId },
      { read: true },
      { new: true }
    );
  },

  markAllRead: async (userId) => {
    return Notification.updateMany({ userId, read: false }, { read: true });
  },

  getUnreadCount: async (userId) => {
    return Notification.countDocuments({ userId, read: false });
  },

  _io: null,
  setIo: (io) => {
    notificationService._io = io;
  },
};

module.exports = notificationService;