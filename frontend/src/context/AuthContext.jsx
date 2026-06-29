import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import authService from '../services/authService.js';
import { setApiToken, clearApiToken } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../sockets/socket.js';
import { refreshOnce } from '../services/refreshManager.js';

const AuthContext = createContext(null);

const REFRESH_INTERVAL_MS = 14 * 60 * 1000; // 14 min — 1 min before access token expires

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading,     setLoading]     = useState(true);

  const accessTokenRef = useRef(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  /**
   * Central helper — always call this instead of setAccessToken directly.
   * Keeps the axios instance (api.js) in sync with React state so every
   * outgoing request automatically carries the current Bearer token.
   */
  const applyToken = useCallback((token) => {
    setAccessToken(token);
    if (token) {
      setApiToken(token);
      // Also expose on window for the socket.client.js lazy read
      window.__wt_access_token__ = token;
    } else {
      clearApiToken();
      window.__wt_access_token__ = null;
    }
  }, []);

  // ── Silent refresh ───────────────────────────────────────────────
  const silentRefresh = useCallback(async () => {
    try {
      const { accessToken: newToken } = await refreshOnce();
      applyToken(newToken);
      return newToken;
    } catch {
      applyToken(null);
      setUser(null);
      disconnectSocket();
      return null;
    }
  }, [applyToken]);

  // ── Restore session on mount ─────────────────────────────────────
  // No localStorage — call /auth/refresh; if the HttpOnly cookie is
  // still valid the server returns a fresh access token.
  useEffect(() => {
    (async () => {
      const newToken = await silentRefresh();
      if (newToken) {
        try {
          const me = await authService.getMe(newToken);
          setUser(me);
          setTimeout(connectSocket, 0);
        } catch {
          applyToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  // ── Periodic silent refresh (Fix 4 — proactive) ──────────────────
  // Runs every 14 min while the tab is active.
  // The reactive path (tab sleep → token expired → 401) is handled by
  // the axios interceptor in api.js which calls /auth/refresh on the
  // first failing request and retries it automatically.
  useEffect(() => {
    if (!accessToken) return;
    const id = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [accessToken, silentRefresh]);

  // ── Global 401 event (fired by api.js when refresh itself fails) ──
  useEffect(() => {
    const handle = () => {
      disconnectSocket();
      applyToken(null);
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handle);
    return () => window.removeEventListener('auth:unauthorized', handle);
  }, [applyToken]);

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async (identifier, password) => {
    const { user: u, accessToken: token } =
      await authService.login(identifier, password);
    applyToken(token);
    setUser(u);
    setTimeout(connectSocket, 0);
    return u;
  }, [applyToken]);

  // ── Register ─────────────────────────────────────────────────────
  const register = useCallback(async (username, email, password) => {
    const { user: u, accessToken: token } =
      await authService.register(username, email, password);
    applyToken(token);
    setUser(u);
    setTimeout(connectSocket, 0);
    return u;
  }, [applyToken]);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await authService.logout(accessTokenRef.current); } catch {}
    disconnectSocket();
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  // ── Logout all devices ───────────────────────────────────────────
  const logoutAll = useCallback(async () => {
    try { await authService.logoutAll(accessTokenRef.current); } catch {}
    disconnectSocket();
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  // ── Forgot password ──────────────────────────────────────────────
  const forgotPassword = useCallback(async (identifier) => {
    await authService.forgotPassword(identifier);
  }, []);

  // ── Reset password ────────────────────────────────────────────────
  const resetPassword = useCallback(async (token, password) => {
    const { user: u, accessToken: newToken } =
      await authService.resetPassword(token, password);
    applyToken(newToken);
    setUser(u);
    setTimeout(connectSocket, 0);
    return u;
  }, [applyToken]);

  // ── Refresh user profile data ─────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authService.getMe(accessTokenRef.current);
      setUser(fresh);
      return fresh;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      else throw err;
    }
  }, [logout]);

  const value = {
    user, accessToken, loading,
    login, register, logout, logoutAll,
    forgotPassword, resetPassword,
    refreshUser, setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
