import API from './api.js';

const authService = {

  // ── Login (email OR username) ─────────────────────────────────────
  // CHANGED: field renamed email → identifier, removed localStorage writes
  login: async (identifier, password) => {
    const res = await API.post('/auth/login', { identifier, password });
    const { accessToken, user } = res.data.data;
    return { accessToken, user };
  },

  // ── Register ──────────────────────────────────────────────────────
  // CHANGED: removed localStorage writes, returns accessToken not token
  register: async (username, email, password) => {
    const res = await API.post('/auth/register', { username, email, password });
    const { accessToken, user } = res.data.data;
    return { accessToken, user };
  },

  // ── Silent refresh ────────────────────────────────────────────────
  // NEW: HttpOnly cookie is sent automatically by the browser
  refresh: async () => {
    const res = await API.post('/auth/refresh');
    return res.data.data; // { accessToken }
  },
  
  // ── Logout current device ─────────────────────────────────────────
  // CHANGED: now calls the server (to revoke the refresh token cookie),
  // no longer touches localStorage
  logout: async () => {
    await API.post('/auth/logout');
  },

  // ── Logout all devices ────────────────────────────────────────────
  // NEW
  logoutAll: async () => {
    await API.post('/auth/logout-all');
  },

  // ── Get current user ──────────────────────────────────────────────
  // UNCHANGED
  getMe: async () => {
    const res = await API.get('/auth/me');
    return res.data.data;
  },

  // ── Forgot password (email OR username) ───────────────────────────
  // NEW
  forgotPassword: async (identifier) => {
    const res = await API.post('/auth/forgot-password', { identifier });
    return res.data.data;
  },

  // ── Reset password ─────────────────────────────────────────────────
  // NEW: token comes from the URL param /reset-password/:token
  resetPassword: async (token, password) => {
    const res = await API.post(`/auth/reset-password/${token}`, { password });
    const { accessToken, user } = res.data.data;
    return { accessToken, user };
  },

  // ── Change password (requires current password) ───────────────────
  // NEW: called from Settings → Security tab
  changePassword: async ({ currentPassword, newPassword }) => {
    const res = await API.post(`/auth/change-password`, { currentPassword, newPassword });
    return res.data.data;
  },

  // ── Active sessions ────────────────────────────────────────────────
  // NEW: powers "Manage Devices" settings UI
  getSessions: async () => {
    const res = await API.get('/auth/sessions');
    return res.data.data; // [{ id, deviceName, createdAt, lastUsed }]
  },

  // ── Revoke one session ─────────────────────────────────────────────
  // NEW: lets users kick a specific device from settings
  revokeSession: async (sessionId) => {
    await API.delete(`/auth/sessions/${sessionId}`);
  },

};

export default authService;