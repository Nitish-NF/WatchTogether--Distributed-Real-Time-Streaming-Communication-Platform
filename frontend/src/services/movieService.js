import API from './api.js';

const movieService = {

  getTrending: async () => {
    const res = await API.get('/movies/trending');
    return res.data.data;
  },

  getNew: async () => {
    const res = await API.get('/movies/new');
    return res.data.data;
  },

  getContinueWatching: async () => {
    const res = await API.get('/movies/continue-watching');
    return res.data.data;
  },

  getByGenre: async () => {
    const res = await API.get('/movies/by-genre');
    return res.data.data;
  },

  search: async (q) => {
    const res = await API.get('/movies/search', { params: { q } });
    return res.data.data;
  },

  getById: async (id) => {
    const res = await API.get(`/movies/${id}`);
    return res.data.data;
  },
  /**
   * Create a watch party room.
   * @param {string} movieId
   * @param {object} config - { name, isPrivate, isLocked, maxViewers }
   */
  createParty: async (movieId, config = {}) => {
    const res = await API.post('/watchparty/create', { movieId, ...config });
    return res.data.data;
  },

  getRoom: async (roomId) => {
    const res = await API.get(`/watchparty/${roomId}`);
    return res.data.data;
  },
};

export default movieService;