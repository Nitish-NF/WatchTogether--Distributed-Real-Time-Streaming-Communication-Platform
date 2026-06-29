const { body, validationResult } = require('express-validator');
const authService = require('./auth.service.js');
const { asyncHandler, sendSuccess, sendError } = require('../../utils/helpers.js');
const { setRefreshCookie, clearRefreshCookie, COOKIE_NAME } = require('../../utils/cookies.js');

// ── Validation helper ─────────────────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(res, errors.array()[0].msg, 422);
    return false;
  }
  return true;
};

// ── Device name from User-Agent ───────────────────────────────────────────
// Passed to the service so it can be stored alongside the token hash,
// enabling the "Active Sessions" UI (Fix 3).
const getDeviceName = (req) => {
  const ua = req.headers['user-agent'] || '';
  // Import lazily so controller doesn't couple to service internals.
  // The parseDeviceName helper lives in auth.service.js but is not
  // exported — duplicate the tiny logic here to keep separation clean.
  const lower = ua.toLowerCase();
  let os      = 'Unknown OS';
  if      (lower.includes('iphone'))   os = 'iPhone';
  else if (lower.includes('ipad'))     os = 'iPad';
  else if (lower.includes('android'))  os = 'Android';
  else if (lower.includes('windows'))  os = 'Windows';
  else if (lower.includes('mac os'))   os = 'Mac';
  else if (lower.includes('linux'))    os = 'Linux';

  let browser = 'Unknown browser';
  if      (lower.includes('edg/'))     browser = 'Edge';
  else if (lower.includes('chrome'))   browser = 'Chrome';
  else if (lower.includes('firefox'))  browser = 'Firefox';
  else if (lower.includes('safari'))   browser = 'Safari';
  else if (lower.includes('opera') || lower.includes('opr/')) browser = 'Opera';

  return `${browser} on ${os}`;
};

// ── Register ──────────────────────────────────────────────────────────────
const register = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const { accessToken, refreshToken, user } = await authService.register(req.body, getDeviceName(req));
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { accessToken, user }, 201);
  }),
];

// ── Login ─────────────────────────────────────────────────────────────────
const login = [
  body('identifier').trim().notEmpty().withMessage('Email or username required'),
  body('password').notEmpty().withMessage('Password required'),

  asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const { accessToken, refreshToken, user } =
      await authService.login(req.body, getDeviceName(req));
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { accessToken, user });
  }),
];

// ── Silent refresh ────────────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return sendError(res, 'No refresh token', 401);

  const { accessToken, refreshToken: newRefreshToken } = await authService.refresh(token);

  setRefreshCookie(res, newRefreshToken);
  sendSuccess(res, { accessToken });
});

// ── Logout (current device) ───────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (req.user && token) await authService.logout(req.user._id, token);
  clearRefreshCookie(res);
  sendSuccess(res, { message: 'Logged out' });
});

// ── Logout all devices ────────────────────────────────────────────────────
const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  sendSuccess(res, { message: 'Logged out from all devices' });
});

// ── Get current user ──────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  sendSuccess(res, user);
});

// ── Active sessions list (Fix 3) ──────────────────────────────────────────
// GET /api/auth/sessions
// Returns: [{ id, deviceName, createdAt, lastUsed }]
// Powers the "Manage Devices" settings UI.
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.getSessions(req.user._id);
  sendSuccess(res, sessions);
});

// ── Revoke one session (Fix 3) ────────────────────────────────────────────
// DELETE /api/auth/sessions/:sessionId
const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.user._id, req.params.sessionId);
  sendSuccess(res, { message: 'Session revoked' });
});

// ── Forgot password ───────────────────────────────────────────────────────
const forgotPassword = [
  body('identifier').trim().notEmpty().withMessage('Email or username required'),

  asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    await authService.forgotPassword(req.body);
    sendSuccess(res, {
      message: 'If an account with that email/username exists, a reset link has been sent.',
    });
  }),
];

// ── Reset password ────────────────────────────────────────────────────────
const resetPassword = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const { accessToken, refreshToken, user } = await authService.resetPassword(
      { token: req.params.token, password: req.body.password },
      getDeviceName(req),
    );
    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { accessToken, user });
  }),
];

// ── Change password ───────────────────────────────────────────────────────
// POST /api/auth/change-password  (requires protect middleware)
const changePassword = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
 
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    await authService.changePassword({
      userId:          req.user._id,
      currentPassword: req.body.currentPassword,
      newPassword:     req.body.newPassword,
    });
    clearRefreshCookie(res);
    sendSuccess(res, { message: 'Password changed. Please sign in again.' });
  }),
];

module.exports = {
  register, login, refresh, logout, logoutAll,
  getMe, getSessions, revokeSession,
  forgotPassword, resetPassword,changePassword,
};
