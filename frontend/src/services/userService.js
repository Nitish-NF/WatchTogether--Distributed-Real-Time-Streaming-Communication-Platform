
import API from './api.js';

const userService = {

  getProfile: async (userId) => {
    const res = await API.get(`/users/${userId}`);
    return res.data.data;
  },

  getWatchHistory: async (userId) => {
    const res = await API.get(`/users/${userId}/history`);
    return res.data.data;
  },

  // PATCH /api/users/me — accepts: name, bio, avatar, isPrivate
  updateProfile: async (data) => {
    const res = await API.patch('/users/me', data);
    console.log("res",res);
    return res.data.data;
  },

  searchUsers: async (query) => {
    const res = await API.get('/users/search', { params: { q: query } });
    return res.data.data;
  },

  saveProgress: async (movieId, progress) => {
    await API.patch(`/users/progress/${movieId}`, { progress });
  },

};

export default userService;