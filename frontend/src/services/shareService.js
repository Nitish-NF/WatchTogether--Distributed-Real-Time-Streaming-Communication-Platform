import API from "./api.js";



export const shareService = {

  shareMovie: async (movieId, userIds = []) => {
    const res = await API.post('/share/movie', { movieId, userIds });
    return res.data.data;
  },

  shareParty: async (roomId, userIds = []) => {
    const res = await API.post('/share/party', { roomId, userIds });
    return res.data.data;
  },

  getFeed: async () => {
    console.log("feed");
    const res = await API.get('/share/feed');
    console.log("feed_come");
    return res.data.data;
  },
  
  getRequests: async () => {
    console.log("req_f");
    const res = await API.get('/share/requests');
    console.log("req_come");
    return res.data.data;
  },
  
  acceptRequest: async (shareId) => {
    const res = await API.patch(`/share/requests/${shareId}/accept`);
    return res.data.data;
  },
  
  declineRequest: async (shareId) => {
    await API.delete(`/share/requests/${shareId}`);
  },
};

export default shareService; 