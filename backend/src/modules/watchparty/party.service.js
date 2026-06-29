const WatchParty = require('./party.model.js');
const Movie      = require('../movies/movie.model.js');
const Conversation = require('../conversations/conversation.model.js');

const partyService = {

  createRoom: async (hostId, movieId, config = {}) => {
    const movie = await Movie.findById(movieId);
    if (!movie) throw Object.assign(new Error('Movie not found'), { statusCode: 404 });

    // Create a persistent conversation thread for this party's chat
    const conversation = await Conversation.create({
      type: 'group',
      name: config.name || movie.title,
      createdBy: hostId,
      participants: [{ _id: hostId }],
    });

    const room = await WatchParty.create({
      movieId,
      movieTitle:     movie.title,
      streamUrl:      movie.streamUrl,
      hostId,
      name:           config.name || movie.title,
      isPrivate:      config.isPrivate  ?? false,
      isLocked:       config.isLocked   ?? false,
      maxViewers:     config.maxViewers  ?? 50,
      participants:   [{ _id: hostId, isHost: true }],
      participantCount: 1,
      conversationId: conversation._id,   // ← link to chat thread
    });

    return room;
  },

  getRoom: async (roomId) => {
    const room = await WatchParty.findById(roomId)
      .populate('hostId', 'username avatar')
      .populate('participants._id', 'username avatar');
    if (!room) throw Object.assign(new Error('Room not found'), { statusCode: 404 });
    return room;
  },

  getPublicRooms: async (movieId = null) => {
    const query = { active: true, isPrivate: false };
    if (movieId) query.movieId = movieId;
    return WatchParty.find(query)
      .sort({ participantCount: -1, createdAt: -1 })
      .limit(20)
      .populate('hostId', 'username avatar')
      .lean();
  },

  getUserParties: async (userId) => {
    return WatchParty.find({
      $or: [{ hostId: userId }, { 'participants._id': userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  },

  addParticipant: async (roomId, user) => {
    const room = await WatchParty.findById(roomId);
    if (!room) return null;

    if (room.isLocked) {
      throw Object.assign(new Error('Room is locked'), { statusCode: 403 });
    }

    if (room.maxViewers && room.participantCount >= room.maxViewers) {
      throw Object.assign(new Error('Room is full'), { statusCode: 403 });
    }

    // Add to WatchParty participants (atomic, no duplicates)
    await WatchParty.updateOne(
      { _id: roomId, 'participants._id': { $ne: user._id } },
      {
        $push: {
          participants: {
            _id:      user._id,
            username: user.username,
            isHost:   false,
          },
        },
      }
    );

    const updated = await WatchParty.findByIdAndUpdate(
      roomId,
      { $inc: { participantCount: 1 } },
      { new: true }
    );

    // Also add the user to the linked conversation so they can read/write messages
    if (room.conversationId) {
      await Conversation.updateOne(
        {
          _id: room.conversationId,
          'participants._id': { $ne: user._id },
        },
        {
          $push: {
            participants: { _id: user._id, username: user.username },
          },
        }
      );
    }

    return updated;
  },

  removeParticipant: async (roomId, userId) => {
    const party = await WatchParty.findByIdAndUpdate(
      roomId,
      { $pull: { participants: { _id: userId } } },
      { new: true }
    );
    if (!party) return;
    await WatchParty.findByIdAndUpdate(party._id, { $inc: { participantCount: -1 } });
    // Note: we intentionally leave the user in the Conversation so they
    // can still see the chat history if they re-join or view it later.
  },

  saveSyncState: async (roomId, { action, time }) => {
    await WatchParty.findByIdAndUpdate(roomId, {
      syncState: { action, time, updatedAt: new Date() },
    });
  },

  closeRoom: async (roomId, hostId) => {
    return WatchParty.findOneAndUpdate(
      { _id: roomId, hostId },
      { active: false, endedAt: Date.now() },
      { new: true }
    );
  },

  findActiveRoomByHost: async (hostId) => {
    return WatchParty.findOne({ hostId, active: true });
  },

  markHostDisconnected: async (hostId) => {
    return WatchParty.findOneAndUpdate(
      { hostId, active: true },
      { hostDisconnectedAt: new Date() },
      { new: true }
    );
  },

  markHostReconnected: async (roomId) => {
    return WatchParty.findByIdAndUpdate(
      roomId,
      { $unset: { hostDisconnectedAt: 1 } },
      { new: true }
    );
  },

  closeInactiveRooms: async () => {
    return WatchParty.updateMany(
      {
        active: true,
        hostDisconnectedAt: {
          $lte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      { active: false, endedAt: new Date() }
    );
  },

  toggleLock: async (roomId, hostId) => {
    const party = await WatchParty.findOne({ _id: roomId, hostId });
    if (!party) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
    party.isLocked = !party.isLocked;
    await party.save();
    return party;
  },
};

module.exports = partyService;