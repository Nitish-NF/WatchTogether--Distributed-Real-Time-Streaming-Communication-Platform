const conversationService = require('./conversation.service.js');

const createConversation = async (req, res, next) => {
  try {
    const { participants } = req.body;
    const conversation = await conversationService.createOrGetConversation({
      participants,
      currentUser: req.user._id,
    });
    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

const getConversations = async (req, res, next) => {
  try {
    const conversations = await conversationService.getUserConversations(req.user._id);
    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
};

// NEW — pending message requests from public strangers
const getConversationRequests = async (req, res, next) => {
  try {
    const requests = await conversationService.getConversationRequests(req.user._id);
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

// NEW — accept a request → moves to main list
const acceptConversationRequest = async (req, res, next) => {
  try {
    const conv = await conversationService.acceptConversationRequest(
      req.params.conversationId,
      req.user._id
    );
    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
};

// NEW — decline a request → deleted
const declineConversationRequest = async (req, res, next) => {
  try {
    await conversationService.declineConversationRequest(
      req.params.conversationId,
      req.user._id
    );
    res.json({ success: true, data: { declined: true } });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const messages = await conversationService.getMessages(
      req.params.id,
      50,
      req.query.before || null
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { type, text, movieId, roomId, movieTitle } = req.body;
    const message = await conversationService.sendMessage({
      conversationId: req.params.id,
      senderId:       req.user._id,
      senderUsername: req.user.username,
      type,
      text,
      movieId,
      movieTitle,
      roomId,
    });
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

const markSeen = async (req, res, next) => {
  try {
    await conversationService.markSeen(req.params.id, req.user._id);
    res.json({ success: true, data: { seen: true } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createConversation,
  getConversations,
  getConversationRequests,
  acceptConversationRequest,
  declineConversationRequest,
  getMessages,
  sendMessage,
  markSeen,
};