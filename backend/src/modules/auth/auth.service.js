const crypto  = require('crypto');
const User    = require('./auth.model.js');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../../utils/jwt.js');
const sendEmail = require('../../utils/sendEmail.js');
const logger    = require('../../utils/logger.js');

// ── Helpers ───────────────────────────────────────────────────────────────

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');



/**
 * Issue both tokens.
 *
 * FIX 1 — VersionError
 * ─────────────────────
 * Old code did: user.refreshTokens.push(...); user.save()
 * When two refresh calls hit simultaneously both read the same document
 * version, and whichever saves second throws a VersionError.
 *
 * Fix: use atomic $push / $pull / $set operations via findByIdAndUpdate
 * so Mongoose never has to version-check the document for these fields.
 * We still need the full user doc for toPublic(), so for login/register
 * we do ONE save (before any concurrent refresh calls could race) and
 * for the hot-path refresh() we use a pure atomic update.
 */
const issueTokensForLogin = async (user, deviceName = 'Unknown device') => {
  const accessToken  = signAccessToken({ id: user._id });
  const refreshToken = signRefreshToken({ id: user._id });

  const entry = {
    tokenHash:  hashToken(refreshToken),
    deviceName,
    createdAt:  new Date(),
    lastUsed:   new Date(),
  };

  // Atomic: push new entry then slice to keep only the 5 most recent
  await User.findByIdAndUpdate(user._id, {
    $push: {
      refreshTokens: {
        $each:     [entry],
        $sort:     { createdAt: 1 },
        $slice:    -5,           // keep newest 5, drop oldest
      },
    },
  });

  return { accessToken, refreshToken };
};

// ── Service ───────────────────────────────────────────────────────────────

const authService = {

  // ── Register ─────────────────────────────────────────────────────────────
  register: async ({ username, email, password }, deviceName) => {
    const user = await User.create({
      username, email, password,
      profiles: [{ name: username }],
    });
    const { accessToken, refreshToken } = await issueTokensForLogin(user, deviceName);
    return { accessToken, refreshToken, user: user.toPublic() };
  },

  // ── Login (username OR email) ─────────────────────────────────────────────
  login: async ({ identifier, password }, deviceName) => {
    const isEmail = identifier.includes('@');
    const user    = isEmail
      ? await User.findOne({ email: identifier.toLowerCase().trim() })
      : await User.findOne({ username: identifier.trim() });

    if (!user)
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

    const valid = await user.comparePassword(password);
    if (!valid)
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

    const { accessToken, refreshToken } = await issueTokensForLogin(user, deviceName);
    return { accessToken, refreshToken, user: user.toPublic() };
  },

  // ── Silent refresh (rotate token) ────────────────────────────────────────
  // FIX 1 — uses findOneAndUpdate with $pull + $push so concurrent
  // refresh calls never race on the same document version.
  refresh: async (incomingRefreshToken) => {
      console.log(
    'Incoming token:',
    incomingRefreshToken
  );
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
    }

    const incomingHash = hashToken(incomingRefreshToken);

    // Atomically find the user AND remove the old token in one round-trip.
    // If the token hash isn't in the array $pull is a no-op — we detect
    // that below by checking whether the session existed before the update.
    const before = await User.findOneAndUpdate(
      { _id: decoded.id, 'refreshTokens.tokenHash': incomingHash },
      { $pull: { refreshTokens: { tokenHash: incomingHash } } },
      { new: false },    // return the doc BEFORE the update so we can read the old entry
    );

    if (!before) {
      // Either user doesn't exist, or token hash not found.
      // Could be reuse — wipe all sessions as a precaution.
      await User.findByIdAndUpdate(decoded.id, { $set: { refreshTokens: [] } });
      throw Object.assign(new Error('Refresh token reuse detected'), { statusCode: 401 });
    }

    // Find the entry we just pulled so we can preserve its device metadata
    const oldEntry = before.refreshTokens.find(s => s.tokenHash === incomingHash);

    const accessToken  = signAccessToken({ id: before._id });
    const refreshToken = signRefreshToken({ id: before._id });

    const newEntry = {
      tokenHash:  hashToken(refreshToken),
      deviceName: oldEntry?.deviceName || 'Unknown device',
      createdAt:  oldEntry?.createdAt  || new Date(),
      lastUsed:   new Date(),
    };

    // Atomically push the new entry, cap at 5
    await User.findByIdAndUpdate(before._id, {
      $push: {
        refreshTokens: {
          $each:  [newEntry],
          $sort:  { createdAt: 1 },
          $slice: -5,
        },
      },
    });

    return { accessToken, refreshToken };
  },

  // ── Logout (single device) ────────────────────────────────────────────────
  logout: async (userId, incomingRefreshToken) => {
    if (!incomingRefreshToken) return;
    const hash = hashToken(incomingRefreshToken);
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: { tokenHash: hash } },
    });
  },

  // ── Logout all devices ────────────────────────────────────────────────────
  logoutAll: async (userId) => {
    await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
  },

  // ── Active sessions ───────────────────────────────────────────────────────
  getSessions: async (userId) => {
    const user = await User.findById(userId).select('refreshTokens');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user.refreshTokens.map((s) => ({
      id:         s._id,
      deviceName: s.deviceName,
      createdAt:  s.createdAt,
      lastUsed:   s.lastUsed,
    }));
  },

  // ── Revoke one session ────────────────────────────────────────────────────
  revokeSession: async (userId, sessionId) => {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: { _id: sessionId } },
    });
  },

  // ── Get current user ──────────────────────────────────────────────────────
  getMe: async (userId) => {
    const user = await User.findById(userId)
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
  },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotPassword: async ({ identifier }) => {
    const isEmail = identifier.includes('@');
    const user    = isEmail
      ? await User.findOne({ email: identifier.toLowerCase().trim() })
      : await User.findOne({ username: identifier.trim() });

    if (!user) return;   // always 200 — never reveal whether account exists

    const plainToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.CLIENT_URL}/reset-password/${plainToken}`;

    try {
      await sendEmail({
        to:      user.email,
        subject: 'Password Reset Request',
        html: `
          <p>Hi ${user.username},</p>
          <p>Click the link below to reset your password.
             It expires in <strong>1 hour</strong>.</p>
          <a href="${resetURL}">${resetURL}</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    } catch (err) {
      // Roll back the token so the user can try again
      user.passwordResetToken   = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`[ForgotPassword] Email failed: ${err.message}`);
      throw Object.assign(new Error('Failed to send reset email'), { statusCode: 500 });
    }
  },

  // ── Reset password ────────────────────────────────────────────────────────
  resetPassword: async ({ token, password }, deviceName) => {
    const hashed = hashToken(token);
    const user   = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      throw Object.assign(new Error('Token is invalid or has expired'), { statusCode: 400 });

    user.password             = password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens        = [];
    await user.save();

    const { accessToken, refreshToken } = await issueTokensForLogin(user, deviceName);
    return { accessToken, refreshToken, user: user.toPublic() };
  },

    // ── Change password (from Settings — user knows current password) ─────────
  changePassword: async ({ userId, currentPassword, newPassword }) => {
    const user = await User.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
 
    const valid = await user.comparePassword(currentPassword);
    if (!valid)
      throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
 
    if (currentPassword === newPassword)
      throw Object.assign(new Error('New password must differ from current'), { statusCode: 400 });
 
    user.password      = newPassword;
    user.refreshTokens = [];   // invalidate all sessions — re-auth required
    await user.save();
  },
};

module.exports = authService;