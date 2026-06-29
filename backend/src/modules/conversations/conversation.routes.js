const express    = require('express');
const router     = express.Router();
const controller = require('./conversation.controller');
const { protect } = require('../../middleware/auth.middleware');

router.use(protect);

// ── Conversations ─────────────────────────────────────────────────
router.post('/', controller.createConversation);
router.get('/',  controller.getConversations);

// ── Message Requests (NEW) ────────────────────────────────────────
// Must be defined BEFORE /:id routes to avoid param collision
router.get('/requests',                                   controller.getConversationRequests);
router.patch('/requests/:conversationId/accept',          controller.acceptConversationRequest);
router.delete('/requests/:conversationId',                controller.declineConversationRequest);

// ── Messages within a conversation ───────────────────────────────
router.get('/:id/messages',  controller.getMessages);
router.post('/:id/messages', controller.sendMessage);
router.patch('/:id/seen',    controller.markSeen);

module.exports = router;