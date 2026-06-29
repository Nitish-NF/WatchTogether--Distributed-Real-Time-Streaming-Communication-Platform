const Movie = require('./movie.model.js');
const User  = require('../users/user.model.js');
const WatchParty = require('../watchparty/party.model.js');
const { formatMovie } = require('../../utils/media.js');

const movieService = {

  getTrending: async () => {
    const movies = await Movie.find({ isTrending: true })
      .sort({ viewCount: -1 })
      .limit(20);
    return movies.map(formatMovie);
  },

  getNew: async () => {
    const movies = await Movie.find({ isNew: true })
      .sort({ createdAt: -1 })
      .limit(20);
    return movies.map(formatMovie);
  },

  getByGenre: async () => {
    const genres = await Movie.distinct('genre');
    const result = {};
    await Promise.all(
      genres.slice(0, 6).map(async (g) => {
        const movies = await Movie.find({ genre: g }).limit(8);
        result[g] = movies.map(formatMovie);
      })
    );
    return result;
  },

  getContinueWatching: async (userId) => {
    const user = await User.findById(userId)
      .select('profiles activeProfile')
      .populate(
        'profiles.watchHistory.movie',
        'title genre year thumbnail color duration streamUrl'
      );
    if (!user) return [];
    const profile = user.profiles[user.activeProfile || 0];
    if (!profile) return [];
    return (profile.watchHistory || [])
      .filter(h => h.movie && h.progress && h.progress < (h.movie.duration * 0.95))
      .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
      .slice(0, 10)
      .map(h => ({ movie: formatMovie(h.movie), progress: h.progress }));
  },

  search: async (q) => {
    if (!q) return [];
    const movies = await Movie.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);
    return movies.map(formatMovie);
  },

  getById: async (userId,movieId) => {
    const movie = await Movie.findByIdAndUpdate(
      movieId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!movie) throw Object.assign(new Error('Movie not found'), { statusCode: 404 });

    let progress = 0;

    if (userId) {
      const user = await User.findById(userId);
      const profile =
        user?.profiles?.[user.activeProfile || 0];

      const history = profile?.watchHistory?.find(
        h => h.movie?.toString() === movieId.toString()
      );
      progress = history?.progress || 0;
    }

    const relatedMovies = await Movie.find({
      genre: movie.genre,
      _id: { $ne: movie._id },
    }).limit(6);
    console.log(progress);
        return {
      ...formatMovie(movie),
      progress,
      related: relatedMovies.map(formatMovie),
    };
  },

  create: async (data) => {
    const movie = await Movie.create(data);
    return formatMovie(movie);
  },

  update: async (id, data) => {
    const movie = await Movie.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      new: true,
    });
    return formatMovie(movie);
  },

  // ✅ FIX: was using undefined `API` (frontend import). Now uses DB directly.
  getRoom: async (roomId) => {
    const party = await WatchParty.findById(roomId)
      .populate('hostId', 'username avatar')
      .populate('participants._id', 'username avatar');
    if (!party) throw Object.assign(new Error('Room not found'), { statusCode: 404 });
    return party;
  },

  delete: async (id) => {
    return Movie.findByIdAndDelete(id);
  },
};

module.exports = movieService;