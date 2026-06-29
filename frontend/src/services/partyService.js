import API from "./api.js";

const partyService = {
  saveSyncState: async (roomId, { action, time }) => {
    const res = await API.patch(`/watchparty/${roomId}/sync`, { action, time });
    return res.data.data;
  },

  getRoom: async (roomId) => {
    const res = await API.get(`/watchparty/${roomId}`);
    return res.data.data;
  },

  getPublicRooms: async (movieId = null) => {
    const url = movieId ? `/watchparty/public?movieId=${movieId}` : '/watchparty/public';
    const res = await API.get(url);
    return res.data.data;
  },

  closeRoom: async (roomId) => {
    const res = await API.patch(`/watchparty/${roomId}/close`);
    return res.data.data;
  },

  /** Toggle room lock on/off — host only */
  toggleLock: async (roomId) => {
    const res = await API.patch(`/watchparty/${roomId}/lock`);
    return res.data.data;
  },

  /** Get all parties the current user has hosted or joined */
  getMyParties: async () => {
    const res = await API.get('/watchparty/mine');
    return res.data.data;
  },
};

export default partyService;