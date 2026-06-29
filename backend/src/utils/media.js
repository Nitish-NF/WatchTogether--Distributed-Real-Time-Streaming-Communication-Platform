const STREAM_BASE_URL = process.env.STREAM_BASE_URL || 'http://localhost:8080';

const makeUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path; // already absolute — don't double-prefix
  return `${STREAM_BASE_URL}${path}`;
};

const formatMovie = (movie) => ({
  ...movie.toObject(),
  thumbnail: makeUrl(movie.thumbnail),
  streamUrl: makeUrl(movie.streamUrl),
});

module.exports = { formatMovie };