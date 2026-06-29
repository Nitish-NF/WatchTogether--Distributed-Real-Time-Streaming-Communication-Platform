const { verifyAccessToken } = require('../utils/jwt.js');
const User = require('../modules/auth/auth.model.js');
const { sendError } = require('../utils/helpers.js');

/**
 * Protect — blocks the request if a valid access token is not present.
 *
 * The access token is stored in JS memory on the client and sent as a
 * standard Authorization: Bearer <token> header.  It is NEVER stored in
 * localStorage or a cookie, so if it is stolen the attacker only has a
 * 15-minute window before it expires.
 */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return sendError(res, 'Not authenticated', 401);
    }

    const token   = header.split(' ')[1];
    const decoded = verifyAccessToken(token);  // throws if expired / invalid

    const user = await User.findById(decoded.id)
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires');

    if (!user) return sendError(res, 'User not found', 401);

    req.user = user;
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

/**
 * Optional auth — silently attaches req.user when a valid token is present.
 * Never blocks the request.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(header.split(' ')[1]);
      req.user = await User.findById(decoded.id)
        .select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
    }
  } catch {}
  next();
};

module.exports = { protect, optionalAuth };
