const WatchParty = require('./party.model.js');
const Movie      = require('../movies/movie.model.js');
const Conversation = require('../conversations/conversation.model.js');
const User        = require('../users/user.model.js');

const partyService = {

  createRoom: async (hostId, movieId, config = {}) => {
    const movie = await Movie.findById(movieId);
    if (!movie) throw Object.assign(new Error('Movie not found'), { statusCode: 404 });

    const host = await User.findById(hostId).select('username');

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
      // The host is always the first participant, and is treated as if
      // they'd invited themselves: joinedByInvite=true, isPresent=true.
      // isPresent flips to false on disconnect and back to true on
      // reconnect via the normal join flow — it is never removed.
      participants: [{
        _id:            hostId,
        username:       host?.username,
        isHost:         true,
        joinedByInvite: true,
        isPresent:      true,
        joinedAt:       new Date(),
      }],
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

  /**
   * Called by the host (or the share flow) when a private-room invitation is
   * sent. Creates a participant record up front with isPresent=false, so the
   * server has a record of "who was invited" before they ever join.
   * Idempotent: if the user is already a participant (e.g. re-invited, or
   * already joined) this is a no-op for them.
   */
  inviteParticipants: async (roomId, hostId, userIds = []) => {
    console.log("litsen invite");
    const room = await WatchParty.findOne({ _id: roomId, hostId });
    if (!room) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

    const existingIds = new Set(room.participants.map(p => p._id?.toString()));
    const newIds = userIds.filter(id => !existingIds.has(id.toString()));
    if (!newIds.length) return room;

    const users = await User.find({ _id: { $in: newIds } }).select('username');

    await WatchParty.updateOne(
      { _id: roomId },
      {
        $push: {
          participants: {
            $each: users.map(u => ({
              _id:            u._id,
              username:       u.username,
              isHost:         false,
              joinedByInvite: true,
              isPresent:      false,
            })),
          },
        },
      }
    );

    // Invited users can also read/write the party chat once they join, so
    // give them access to the conversation thread right away.
    if (room.conversationId && users.length) {
      await Conversation.updateOne(
        { _id: room.conversationId },
        {
          $addToSet: {
            participants: { $each: users.map(u => ({ _id: u._id, username: u.username })) },
          },
        }
      );
    }

    return WatchParty.findById(roomId);
  },

  /**
   * Join flow, per the updated design:
   *  - Public room: participant is found-or-created, then marked present.
   *  - Private room: the user MUST already have a participant record
   *    (host, or invited). No record → 403. Kicked → rejected.
   */
  addParticipant: async (roomId, user) => {
    const room = await WatchParty.findById(roomId);
    if (!room) return null;
    if (!room.active) throw Object.assign(new Error('Room is no longer active'), { statusCode: 410 });

    if (room.isLocked) {
      throw Object.assign(new Error('Room is locked'), { statusCode: 403 });
    }

    const existing = room.participants.find(p => p._id?.toString() === user._id.toString());

    if (room.isPrivate) {
      if (!existing) {
        throw Object.assign(new Error('This is a private party — you need an invitation to join'), { statusCode: 403 });
      }
      if (existing.isKicked) {
        throw Object.assign(new Error('You have been removed from this party'), { statusCode: 403 });
      }
    } else if (!existing && room.maxViewers && room.participantCount >= room.maxViewers) {
      throw Object.assign(new Error('Room is full'), { statusCode: 403 });
    }

    if (existing) {
      if (existing.isKicked) {
        throw Object.assign(new Error('You have been removed from this party'), { statusCode: 403 });
      }
      // Reconnect: flip isPresent back on, no duplicate record, no count bump
      // if they were already counted as present (defensive against double joins).
      const wasPresent = existing.isPresent;
      await WatchParty.updateOne(
        { _id: roomId, 'participants._id': user._id },
        {
          $set: {
            'participants.$.isPresent': true,
            'participants.$.joinedAt':  new Date(),
          },
        }
      );
      if (!wasPresent) {
        await WatchParty.findByIdAndUpdate(roomId, { $inc: { participantCount: 1 } });
      }
    } else {
      // Public room, first time we've seen this user — create the record.
      await WatchParty.updateOne(
        { _id: roomId, 'participants._id': { $ne: user._id } },
        {
          $push: {
            participants: {
              _id:            user._id,
              username:       user.username,
              isHost:         false,
              joinedByInvite: false,
              isPresent:      true,
              joinedAt:       new Date(),
            },
          },
        }
      );
      await WatchParty.findByIdAndUpdate(roomId, { $inc: { participantCount: 1 } });

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
    }

    return WatchParty.findById(roomId);
  },

  /**
   * Disconnect / leave: the participant record is kept (so invitation and
   * attendance history survive), only isPresent flips off.
   */
  removeParticipant: async (roomId, userId) => {
    const room = await WatchParty.findOne({ _id: roomId, 'participants._id': userId, 'participants.isPresent': true });
    if (!room) return;

    await WatchParty.updateOne(
      { _id: roomId, 'participants._id': userId },
      { $set: { 'participants.$.isPresent': false } }
    );
    await WatchParty.findByIdAndUpdate(roomId, { $inc: { participantCount: -1 } });
    // Note: we intentionally leave the user in the Conversation so they
    // can still see the chat history if they re-join or view it later.
  },

  /** Host-initiated removal — future join attempts are rejected. */
  kickParticipant: async (roomId, targetUserId) => {
    const room = await WatchParty.findOne({ _id: roomId, 'participants._id': targetUserId });
    if (!room) return null;
    const target = room.participants.find(p => p._id?.toString() === targetUserId.toString());
    const wasPresent = target?.isPresent;

    await WatchParty.updateOne(
      { _id: roomId, 'participants._id': targetUserId },
      {
        $set: {
          'participants.$.isKicked':  true,
          'participants.$.isPresent': false,
        },
      }
    );
    if (wasPresent) {
      await WatchParty.findByIdAndUpdate(roomId, { $inc: { participantCount: -1 } });
    }
    return WatchParty.findById(roomId);
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