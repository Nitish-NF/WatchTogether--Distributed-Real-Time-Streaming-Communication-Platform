import API from './api.js';

// ─── Follow Service ───────────────────────────────────────────────────────────

export const followService = {

  sendRequest: async (targetId) => {
    const res = await API.post(`/follow/request/${targetId}`);
    return res.data.data;
  },

  cancelRequest: async (targetId) => {
    const res = await API.delete(`/follow/request/${targetId}`);
    return res.data.data;
  },

  accept: async (requesterId) => {
    const res = await API.post(`/follow/accept/${requesterId}`);
    return res.data.data;
  },

  reject: async (requesterId) => {
    const res = await API.delete(`/follow/reject/${requesterId}`);
    return res.data.data;
  },

  unfollow: async (targetId) => {
    const res = await API.delete(`/follow/${targetId}`);
    return res.data.data;
  },

  getStatus: async (targetId) => {
    const res = await API.get(`/follow/status/${targetId}`);
    return res.data.data;
  },

  getFollowers: async (userId) => {
    const res = await API.get(`/follow/followers/${userId}`);
    return res.data.data;
  },

  getFollowing: async (userId) => {
    const res = await API.get(`/follow/following/${userId}`);
    return res.data.data;
  },
};


// ─── Notification Service ─────────────────────────────────────────────────────

export const notificationService = {

  getNotifications: async () => {
    const res = await API.get('/notifications');
    return res.data.data;
  },

  markRead: async (id) => {
    await API.patch(`/notifications/${id}/read`);
  },

  markAllRead: async () => {
    await API.patch('/notifications/read-all');
  },

  getUnreadCount: async () => {
    const res = await API.get('/notifications/unread-count');
    return res.data.data?.count ?? 0;
  },
};

export default followService;