const Follow = require('./follow.model.js');
const User   = require('../users/user.model.js');
const notificationService = require('../notifications/notification.service.js');
const {getIO } =require('../../websocket/socketStore.js')

const followService = {

  sendRequest: async (requesterId, recipientId) => {
    if (requesterId.toString() === recipientId.toString()) {
      throw Object.assign(new Error('Cannot follow yourself'), { statusCode: 400 });
    }

    const recipient = await User.findById(recipientId).select('username isPrivate');
    if (!recipient) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const existing = await Follow.findOne({ requester: requesterId, recipient: recipientId });
    if (existing) throw Object.assign(new Error('Relationship already exists'), { statusCode: 409 });

    const status = recipient.isPrivate ? 'pending' : 'accepted';
    const follow = await Follow.create({ requester: requesterId, recipient: recipientId, status });

    if (status === 'accepted') {
      await Promise.all([
        User.findByIdAndUpdate(requesterId, { $inc: { followingCount: 1 } }),
        User.findByIdAndUpdate(recipientId,  { $inc: { followersCount: 1 } }),
      ]);
    }

    const requester = await User.findById(requesterId).select('username avatar');

    await notificationService.create({
      userId:   recipientId,
      type:     status === 'pending' ? 'follow_request' : 'new_follower',
      fromUser: requesterId,
      message:  status === 'pending'
        ? 'sent you a follow request.'
        : 'started following you.',
    });

    const io = getIO();
    if (io) {
      /**
       * FIX: include ALL fields the frontend needs:
       *   - fromUser: who triggered the action
       *   - targetUser: who the action was about (= the recipient)
       *   - status: 'pending' or 'accepted' so frontend knows which state to apply
       *
       * Emit to the RECIPIENT's personal room so they see the button change.
       * Also emit to the REQUESTER's room (they may have the profile open in
       * another tab, and their own button should flip to 'requested'/'following').
       */
      const payload = {
        fromUser:   { _id: requesterId.toString(), username: requester.username },
        targetUser: { _id: recipientId.toString() },
        status,
      };

      // Recipient sees the incoming request / new follower
      io.to(`user:${recipientId}`).emit('follow:request', payload);

      // Requester's other tabs / profile view sync
      io.to(`user:${requesterId}`).emit('follow:sent', payload);
    }

    return { follow, status };
  },

  acceptRequest: async (recipientId, requesterId) => {
    const follow = await Follow.findOneAndUpdate(
      { requester: requesterId, recipient: recipientId, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    );
    if (!follow) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

    await Promise.all([
      User.findByIdAndUpdate(requesterId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(recipientId,  { $inc: { followersCount: 1 } }),
    ]);

    const recipient = await User.findById(recipientId).select('username');

    await notificationService.create({
      userId:   requesterId,
      type:     'follow_accepted',
      fromUser: recipientId,
      message:  'accepted your follow request.',
    });

    const io = getIO();
    if (io) {
      const payload = {
        fromUser:   { _id: recipientId.toString(), username: recipient.username },
        targetUser: { _id: requesterId.toString() },
      };
      // Tell the original requester their request was accepted
      io.to(`user:${requesterId}`).emit('follow:accepted', payload);
      // Tell the recipient (acceptor) their own follower count changed
      io.to(`user:${recipientId}`).emit('follow:accepted', payload);
    }

    return follow;
  },

  rejectRequest: async (recipientId, requesterId) => {
    const result = await Follow.deleteOne({
      requester: requesterId,
      recipient: recipientId,
      status: 'pending',
    });
    if (!result.deletedCount) {
      throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    }
    return { rejected: true };
  },

  cancelRequest: async (requesterId, recipientId) => {
    await Follow.deleteOne({ requester: requesterId, recipient: recipientId, status: 'pending' });

    const io = getIO();
    if (io) {
      // Notify the recipient so their profile page can remove the pending indicator
      io.to(`user:${recipientId}`).emit('follow:cancelled', {
        fromUser: { _id: requesterId.toString() },
        targetUser: { _id: recipientId.toString() },
      });
    }

    return { cancelled: true };
  },

  unfollow: async (requesterId, recipientId) => {
    const result = await Follow.deleteOne({
      requester: requesterId,
      recipient: recipientId,
      status: 'accepted',
    });
    if (result.deletedCount) {
      await Promise.all([
        User.findByIdAndUpdate(requesterId, { $inc: { followingCount: -1 } }),
        User.findByIdAndUpdate(recipientId,  { $inc: { followersCount: -1 } }),
      ]);
    }

    const io = getIO();
    if (io) {
      const payload = {
        fromUser:   { _id: requesterId.toString() },
        targetUser: { _id: recipientId.toString() },
      };
      io.to(`user:${recipientId}`).emit('follow:removed', payload);
      io.to(`user:${requesterId}`).emit('follow:removed', payload);
    }

    return { unfollowed: true };
  },

  getStatus: async (viewerId, targetId) => {
    const [outgoing, incoming] = await Promise.all([
      Follow.findOne({ requester: viewerId,  recipient: targetId }),
      Follow.findOne({ requester: targetId,  recipient: viewerId }),
    ]);

    if (outgoing?.status === 'accepted' && incoming?.status === 'accepted')
      return { status: 'mutual_follow' };
    if (outgoing?.status === 'accepted')
      return { status: 'following' };
    if (incoming?.status === 'accepted')
      return { status: 'follow_back' };
    if (outgoing?.status === 'pending')
      return { status: 'requested' };
    if (incoming?.status === 'pending')
      return { status: 'accept' };

    return { status: 'none' };
  },

  getFollowers: async (userId) => {
    const follows = await Follow.find({ recipient: userId, status: 'accepted' })
      .populate('requester', 'username avatar followersCount');
    return follows.map(f => f.requester);
  },

  getFollowing: async (userId) => {
    const follows = await Follow.find({ requester: userId, status: 'accepted' })
      .populate('recipient', 'username avatar followersCount');
    return follows.map(f => f.recipient);
  },

  getFollowerIds: async (userId) => {
    const follows = await Follow.find({ recipient: userId, status: 'accepted' }).select('requester');
    return follows.map(f => f.requester);
  },
};

module.exports = followService;