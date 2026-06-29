const Conversation  = require('./conversation.model.js');
const Message       = require('./message.model.js');
const User          = require('../users/user.model.js');
const followService = require('../follow/follow.service.js');

// ── Privacy helper ────────────────────────────────────────────────
/**
 * Returns { mode: 'direct' | 'request' } or throws 403 for locked.
 *
 *   direct  — follow relationship exists either way → straight through
 *   request — public stranger, no follow → goes to Message Requests
 *   locked  — private stranger, no follow → blocked, 403
 */
const checkContactPermission = async (fromUserId, toUserId) => {
  const [recipient, followers, following] = await Promise.all([
    User.findById(toUserId).select('isPrivate username').lean(),
    followService.getFollowers(fromUserId),
    followService.getFollowing(fromUserId),
  ]);

  if (!recipient) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const toIdStr      = toUserId.toString();
  const theyFollowMe = followers.some(u => u._id.toString() === toIdStr);
  const iFollowThem  = following.some(u => u._id.toString() === toIdStr);
  const connected    = theyFollowMe || iFollowThem;

  if (connected)            return { mode: 'direct',  recipient };
  if (!recipient.isPrivate) return { mode: 'request', recipient };

  throw Object.assign(
    new Error(`@${recipient.username} has a private account. Follow them first.`),
    { statusCode: 403 }
  );
};

// ── Service ───────────────────────────────────────────────────────

/**
 * Find an existing DM between exactly these two participants, or create it.
 * For groups always create a new conversation.
 *
 * CHANGED: runs checkContactPermission for DMs so private strangers
 * are blocked and public strangers get isRequest: true.
 */
const createOrGetConversation = async ({ participants, currentUser }) => {
  const allParticipants = [currentUser.toString(), ...participants.map(id => id.toString())];
  const unique = [...new Set(allParticipants)];

  if (unique.length === 2) {
    // DM — find existing conversation first
    const existing = await Conversation.findOne({
      type: 'dm',
      participants: { $size: 2 },
      $and: [
        { 'participants._id': unique[0] },
        { 'participants._id': unique[1] },
      ],
    });
    if (existing) return existing;

    // NEW: privacy check before creating
    const otherId = unique.find(id => id !== currentUser.toString());
    const { mode } = await checkContactPermission(currentUser, otherId);

    const conversation = await Conversation.create({
      type:        'dm',
      createdBy:   currentUser,
      participants: unique.map(id => ({ _id: id })),
      isRequest:   mode === 'request',   // true = public stranger
    });

    return conversation;
  }

  // Group — no privacy check
  const conversation = await Conversation.create({
    type:        'group',
    createdBy:   currentUser,
    participants: unique.map(id => ({ _id: id })),
  });

  return conversation;
};

/**
 * Get normal conversations (isRequest false) for the sidebar.
 */
const getUserConversations = async (userId) => {
  return Conversation.find({
    'participants._id': userId,
    active:    true,
    isRequest: { $ne: true },   // CHANGED: exclude requests from main list
  })
    .sort({ updatedAt: -1 })
    .lean();
};

/**
 * NEW — get pending message requests (from public strangers).
 */
const getConversationRequests = async (userId) => {
  return Conversation.find({
    'participants._id': userId,
    active:    true,
    isRequest: true,
  })
    .sort({ updatedAt: -1 })
    .lean();
};

/**
 * NEW — accept a message request → moves to normal list.
 */
const acceptConversationRequest = async (conversationId, userId) => {
  const conv = await Conversation.findOneAndUpdate(
    {
      _id:               conversationId,
      'participants._id': userId,
      isRequest:         true,
    },
    { isRequest: false },
    { new: true }
  );
  if (!conv) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  return conv;
};

/**
 * NEW — decline a message request → deletes it entirely.
 */
const declineConversationRequest = async (conversationId, userId) => {
  const result = await Conversation.deleteOne({
    _id:               conversationId,
    'participants._id': userId,
    isRequest:         true,
  });
  if (!result.deletedCount)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  return { declined: true };
};

const getMessages = async (conversationId, limit = 50, before = null) => {
  const query = { conversationId };
  if (before) query.createdAt = { $lt: new Date(before) };
  const messages = await Message.find(query)
    .populate('movieId', 'title thumbnail genre year color')
    .populate('roomId',  'roomName active')
    .sort({ createdAt: before ? -1 : 1 })
    .limit(limit)
    .lean();
  return before ? messages.reverse() : messages;
};

const sendMessage = async ({
  conversationId,
  senderId,
  senderUsername,
  type = 'text',
  text,
  movieId,
  movieTitle,
  roomId,
}) => {
  const conv = await Conversation.findOne({
    _id:               conversationId,
    'participants._id': senderId,
  });
  if (!conv) throw Object.assign(new Error('Conversation not found or access denied'), { statusCode: 403 });

  const message = await Message.create({
    conversationId,
    senderId,
    senderUsername,
    type,
    text,
    movieId,
    movieTitle,
    roomId,
    seenBy: [senderId],
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: {
      text:      type === 'text' ? text : `📎 ${type}`,
      senderId,
      type,
      createdAt: new Date(),
    },
    updatedAt: new Date(),
  });

  return message;
};

const markSeen = async (conversationId, userId) => {
  await Message.updateMany(
    { conversationId, seenBy: { $ne: userId } },
    { $addToSet: { seenBy: userId } }
  );
};

module.exports = {
  createOrGetConversation,
  getUserConversations,
  getConversationRequests,       // NEW
  acceptConversationRequest,     // NEW
  declineConversationRequest,    // NEW
  getMessages,
  sendMessage,
  markSeen,
};