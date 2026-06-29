/**
 * Shared avatar colour helper — used across HomePage, FeedPage, DiscoverPage, ShareMovie.
 * Assign a consistent colour to a user based on the first character of their username.
 */
export const AVATAR_COLORS = [
  '#b71c1c', '#1a237e', '#1b5e20',
  '#4a148c', '#e65100', '#006064', '#880e4f',
];

/**
 * @param {string|undefined} username
 * @returns {string} hex colour
 */
export const getAvatarColor = (username) =>
  AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
