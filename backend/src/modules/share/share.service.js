const Share       = require('./share.model.js');
const Movie       = require('../movies/movie.model.js');
const WatchParty  = require('../watchparty/party.model.js');
const User        = require('../users/user.model.js');
const followService       = require('../follow/follow.service.js');
const notificationService = require('../notifications/notification.service.js');
const { getIO } = require('../../websocket/socket.js');

/**
 * getContactMode(fromUserId, toUserId)
 * ─────────────────────────────────────
 * Uses the existing followService to determine the relationship.
 *
 * Returns:
 *   'direct'  — follow relationship exists either way → action goes straight through
 *   'request' — toUser is public, no follow relationship → goes to requests section
 *   'locked'  — toUser is private, no follow relationship → blocked, throws 403
 */
const getContactMode = async (fromUserId, toUserId) => {
  const [recipient, followers, following] = await Promise.all([
    User.findById(toUserId).select('isPrivate username').lean(),
    followService.getFollowers(fromUserId),   // people who follow ME
    followService.getFollowing(fromUserId),   // people I follow
  ]);

  if (!recipient) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const toIdStr      = toUserId.toString();
  const theyFollowMe = followers.some(u => u._id.toString() === toIdStr);
  const iFollowThem  = following.some(u => u._id.toString() === toIdStr);
  const connected    = theyFollowMe || iFollowThem;

  if (connected)            return { mode: 'direct',  recipient };
  if (!recipient.isPrivate) return { mode: 'request', recipient };

  // Private stranger — blocked
  throw Object.assign(
    new Error(`@${recipient.username} has a private account. Follow them first.`),
    { statusCode: 403 }
  );
};

const shareService = {

  shareMovie: async (fromUserId, movieId, targetUserIds) => {
    const movie = await Movie.findById(movieId);
    if (!movie) throw Object.assign(new Error('Movie not found'), { statusCode: 404 });

    const recipients = targetUserIds?.length
      ? targetUserIds
      : await followService.getFollowerIds(fromUserId);

    if (!recipients.length) return { shared: 0 };

    // Check each recipient — private strangers are skipped, public go as requests
    const checks = await Promise.allSettled(
      recipients.map(uid => getContactMode(fromUserId, uid))
    );

    const allowed = [];
    const blocked = [];
    checks.forEach((r, i) => {
      if (r.status === 'fulfilled') allowed.push({ uid: recipients[i], mode: r.value.mode });
      else blocked.push(recipients[i]);
    });

    if (!allowed.length) return { shared: 0, blocked: blocked.length };

    // Bulk insert shares — tag with isRequest for public strangers
    const docs = allowed.map(({ uid, mode }) => ({
      fromUser:   fromUserId,
      toUser:     uid,
      type:       'movie',
      movieId,
      movieTitle: movie.title,
      isRequest:  mode === 'request',
    }));

    // insertMany returns docs — we need the _id per recipient for shareId
    const inserted = await Share.insertMany(docs, { ordered: false }).catch(() => []);

    // Notify each allowed recipient
    await Promise.all(
      allowed.map(async ({ uid, mode }, i) => {
        const shareDoc = inserted[i];
        await notificationService.create({
          userId:   uid,
          type:     mode === 'request' ? 'movie_share_request' : 'movie_share',
          fromUser: fromUserId,
          movieId,
          shareId:  shareDoc?._id,
          message:  mode === 'request'
            ? `wants to share "${movie.title}" with you.`
            : `shared "${movie.title}" with you.`,
        });
      })
    );

    const io = getIO();
    if (io) {
      allowed.forEach(({ uid, mode }, i) => {
        io.to(`user:${uid}`).emit('movie_share', {
          movieId,
          fromUser:  fromUserId,
          isRequest: mode === 'request',
          shareId:   inserted[i]?._id,
        });
      });
    }

    return { shared: allowed.length, blocked: blocked.length };
  },

  shareParty: async (fromUserId, roomId, targetUserIds) => {
    const party      = await WatchParty.findById(roomId);
    const movieTitle = party?.title || 'a watch party';

    const recipients = targetUserIds?.length
      ? targetUserIds
      : await followService.getFollowerIds(fromUserId);

    if (!recipients.length) return { shared: 0 };

    const checks = await Promise.allSettled(
      recipients.map(uid => getContactMode(fromUserId, uid))
    );

    const allowed = [];
    const blocked = [];
    checks.forEach((r, i) => {
      if (r.status === 'fulfilled') allowed.push({ uid: recipients[i], mode: r.value.mode });
      else blocked.push(recipients[i]);
    });

    if (!allowed.length) return { shared: 0, blocked: blocked.length };

    const docs = allowed.map(({ uid, mode }) => ({
      fromUser:  fromUserId,
      toUser:    uid,
      type:      'party',
      roomId,
      isRequest: mode === 'request',
    }));

    const inserted = await Share.insertMany(docs, { ordered: false }).catch(() => []);

    await Promise.all(
      allowed.map(async ({ uid, mode }, i) => {
        const shareDoc = inserted[i];
        await notificationService.create({
          userId:   uid,
          type:     mode === 'request' ? 'party_invite_request' : 'party_invite',
          fromUser: fromUserId,
          roomId,
          shareId:  shareDoc?._id,
          message:  mode === 'request'
            ? `wants to invite you to watch "${movieTitle}".`
            : `invited you to watch "${movieTitle}".`,
        });
      })
    );

    const io = getIO();
    if (io) {
      allowed.forEach(({ uid, mode }, i) => {
        io.to(`user:${uid}`).emit('party_invite', {
          roomId,
          fromUser:  fromUserId,
          isRequest: mode === 'request',
          shareId:   inserted[i]?._id,
        });
      });
    }

    return { shared: allowed.length, blocked: blocked.length };
  },

  // Normal feed — direct shares only (isRequest false)
  getFeed: async (userId) => {
    return Share.find({ toUser: userId, isRequest: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromUser', 'username avatar')
      .populate('movieId',  'title thumbnail color genre year')
      .lean();
  },

  // NEW — pending requests from public strangers
  getRequests: async (userId) => {
    console.log("req")
    return Share.find({ toUser: userId, isRequest: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromUser', 'username avatar')
      .populate('movieId',  'title thumbnail color genre year')
      .lean();
  },

  // NEW — accept: move from requests to feed
  acceptRequest: async (userId, shareId) => {
    const share = await Share.findOneAndUpdate(
      { _id: shareId, toUser: userId, isRequest: true },
      { isRequest: false },
      { new: true }
    );
    if (!share) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    return share;
  },

  // NEW — decline: delete entirely
  declineRequest: async (userId, shareId) => {
    const result = await Share.deleteOne({ _id: shareId, toUser: userId, isRequest: true });
    if (!result.deletedCount)
      throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    return { declined: true };
  },
};

module.exports = shareService;