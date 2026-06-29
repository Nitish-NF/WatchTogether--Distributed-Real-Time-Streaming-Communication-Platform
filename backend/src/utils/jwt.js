const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'access_dev_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_dev_secret';

const ACCESS_EXPIRES  = '15m';
const REFRESH_EXPIRES = '30d';

/**
 * Sign a short-lived access token (15 min).
 * Payload: { id }  — stored in memory only, never in localStorage.
 */
const signAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

/**
 * Sign a long-lived refresh token (30 days).
 * Stored in an HttpOnly cookie — JS cannot read it.
 */
const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

const verifyAccessToken  = (token) => jwt.verify(token, ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
