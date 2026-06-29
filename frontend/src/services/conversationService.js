import API from './api.js';

const conversationService = {

  // ── unchanged ─────────────────────────────────────────────────────
  createConversation: async (participants) => {
    const res = await API.post('/conversations', { participants });
    return res.data.data;
  },

  getConversations: async () => {
    const res = await API.get('/conversations');
    return res.data.data;
  },

  getMessages: async (conversationId, before = null) => {
    const params = before ? { before } : {};
    const res = await API.get(`/conversations/${conversationId}/messages`, { params });
    return res.data.data;
  },

  sendMessage: async (conversationId, data) => {
    // data: { type, text } | { type: 'movie', movieId } | { type: 'party', roomId }
    const res = await API.post(`/conversations/${conversationId}/messages`, data);
    return res.data.data;
  },

  markSeen: async (conversationId) => {
    await API.patch(`/conversations/${conversationId}/seen`);
  },

  // ── NEW: message requests from public strangers ───────────────────

  getConversationRequests: async () => {
    const res = await API.get('/conversations/requests');
    return res.data.data;
  },

  acceptConversationRequest: async (conversationId) => {
    const res = await API.patch(`/conversations/requests/${conversationId}/accept`);
    return res.data.data;
  },

  declineConversationRequest: async (conversationId) => {
    await API.delete(`/conversations/requests/${conversationId}`);
  },
};

export default conversationService;