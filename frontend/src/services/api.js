import axios from 'axios';
import { reconnectSocket } from '../sockets/socket.js';
import { refreshOnce } from './refreshManager.js';

const API = axios.create({
  baseURL:         process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,   // sends HttpOnly refresh cookie on /auth/* routes
  timeout:         15000,
});

// ── In-memory token store ─────────────────────────────────────────
// CHANGED: was localStorage.getItem('wt_token')
// Access token lives here — never in localStorage or a cookie.
// AuthContext.applyToken() calls setApiToken() after every login/refresh.
let _accessToken = null;
export const setApiToken   = (token) => { _accessToken = token; };
export const clearApiToken = ()      => { _accessToken = null;  };

// ── Request interceptor: attach JWT ──────────────────────────────
// CHANGED: reads _accessToken from memory instead of localStorage
API.interceptors.request.use(
  (config) => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ─────────────────────────────
// CHANGED: instead of immediately firing auth:unauthorized, first attempt
// a silent refresh. Only fire the event if the refresh itself fails.
let _isRefreshing = false;
let _refreshQueue = [];  // pending requests while refresh is in flight

const processQueue = (error, token = null) => {
  _refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  _refreshQueue = [];
};

API.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;

    // Only intercept 401s that haven't been retried yet.
    // Skip the refresh endpoint itself to avoid infinite loops.
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    // Multiple requests failed simultaneously — queue them while
    // one refresh call is in flight.
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return API(original);
      });
    }

    original._retry = true;
    _isRefreshing   = true;

    try {
      // HttpOnly cookie sent automatically — no token needed in body
      const res = await refreshOnce();
      const newToken = res.accessToken;

      setApiToken(newToken);
      window.__wt_access_token__ = newToken;   // socket reads this on reconnect

      // Reconnect socket with fresh token so watch parties don't lose auth
      reconnectSocket();

      processQueue(null, newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return API(original);

    } catch (refreshError) {
      // Refresh token expired/revoked — full logout
      processQueue(refreshError, null);
      clearApiToken();
      window.__wt_access_token__ = null;

      // Same event your original code fired — AuthContext handles the rest
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));

      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  }
);

export default API;
