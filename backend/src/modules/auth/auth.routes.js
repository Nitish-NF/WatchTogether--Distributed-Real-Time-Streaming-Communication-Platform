const router = require('express').Router();
const {
  register, login, refresh, logout, logoutAll,
  getMe, getSessions, revokeSession,
  forgotPassword, resetPassword,changePassword
} = require('./auth.controller.js');
const { protect } = require('../../middleware/auth.middleware.js');

// ── Public ────────────────────────────────────────────────────────────────
router.post('/register',              register);
router.post('/login',                 login);
router.post('/refresh',               refresh);           // uses HttpOnly cookie
router.post('/forgot-password',       forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ── Protected (valid access token required) ───────────────────────────────
router.get('/me',                     protect, getMe);
router.post('/logout',                protect, logout);
router.post('/logout-all',            protect, logoutAll);

// Fix 3 — Active Sessions (Manage Devices)
router.get('/sessions',               protect, getSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);
router.post('/change-password',        protect, changePassword);

module.exports = router;
