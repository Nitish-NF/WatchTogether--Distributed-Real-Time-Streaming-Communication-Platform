import React, { useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, useLocation,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import socket from './sockets/socket.js';

// ── Lazy pages ────────────────────────────────────────────────────
const HomePage     = lazy(() => import('./pages/HomePage'));
const LoginPage    = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MoviePage    = lazy(() => import('./pages/MoviePage'));
const Profile      = lazy(() => import('./pages/Profile'));
const FeedPage     = lazy(() => import('./pages/FeedPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const WatchParty   = lazy(() => import('./pages/WatchParty'));
const CreateParty  = lazy(() => import('./pages/CreateParty'));
const ShareMovie   = lazy(() => import('./pages/ShareMovie'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const SoloWatch    = lazy(() => import('./pages/SoloWatch'));
const ForgotPasswordPage  = lazy(()=> import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(()=> import('./pages/ResetPasswordPage'))
const ActiveSessionsPage = lazy(()=> import('./pages/ActiveSessionsPage'))
const LandingPage = lazy(()=> import('./pages/LandingPage.jsx'))

function PageSpinner() {
  return <div className="loading-screen"><div className="spinner" /></div>;
}

// ── Route guards ──────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (user)    return <Navigate to="/home" replace />;
  return children;
}

// ── Socket: join personal user room ──────────────────────────────
/**
 * FIX: previous version had a race condition —
 *
 *   if (socket.connected) {
 *     emit(join_user_room)          ← path A
 *   } else {
 *     socket.on('connect', handler) ← path B
 *   }
 *
 * Problem: if the socket connects in the tiny gap BETWEEN the `if`
 * check and the `socket.on(...)` call (path B branch), the 'connect'
 * event has already fired and the handler is registered too late —
 * join_user_room is never emitted.
 *
 * Fix: ALWAYS register the 'connect' listener, then also emit
 * immediately if already connected. This is safe because socket.io
 * deduplicates listeners with the same reference.
 *
 * Also: we must re-emit join_user_room on every reconnect (not just
 * the first connect), because the server-side room membership is
 * lost whenever the socket disconnects.
 */
function SocketUserRoom() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?._id) return;

    const userId = user._id;

    const joinRoom = () => {
      socket.emit('join_user_room', { userId });
    };

    // Register FIRST — handles future connects AND reconnects
    socket.on('connect', joinRoom);

    // Then emit immediately if already connected (handles the case
    // where the socket was already connected before this effect ran)
    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.off('connect', joinRoom);
    };
  }, [user?._id]); // re-runs if the logged-in user changes

  // ── Global connection-lost banner ─────────────────────────────
  useEffect(() => {
    const onFailed = () => {
      // You can replace this with a toast or a UI banner component
      console.error('[Socket] Connection permanently lost — please refresh.');
    };
    const onReconnected = () => {
      console.log('[Socket] Connection restored.');
    };

    window.addEventListener('socket:connection_failed', onFailed);
    window.addEventListener('socket:reconnected',       onReconnected);

    return () => {
      window.removeEventListener('socket:connection_failed', onFailed);
      window.removeEventListener('socket:reconnected',       onReconnected);
    };
  }, []);

  return null;
}

// ── App shell ─────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <SocketUserRoom />
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Guest only */}
            <Route path="/"      element={<GuestOnly><LandingPage /></GuestOnly>}/>
            <Route path="/login"    element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
            <Route path="/reset-password/:token"  element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />

            {/* Protected */}
            <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/settings/sessions"element={<RequireAuth><ActiveSessionsPage /></RequireAuth>}/>
            <Route path="/settings/sessions"element={<RequireAuth><ActiveSessionsPage /></RequireAuth>}/>
            <Route path="/feed"      element={<RequireAuth><FeedPage /></RequireAuth>} />
            <Route path="/discover"  element={<RequireAuth><DiscoverPage /></RequireAuth>} />
            <Route path="/movie/:id" element={<RequireAuth><MoviePage /></RequireAuth>} />
            <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
            <Route path="/messages/:conversationId" element={<RequireAuth><MessagesPage /></RequireAuth>} />
            <Route path="/party/create/:movieId"  element={<RequireAuth><CreateParty /></RequireAuth>} />
            <Route path="/party/:roomId" element={<RequireAuth><WatchParty /></RequireAuth>} />
            <Route path="/share/movie/:movieId" element={<RequireAuth><ShareMovie /></RequireAuth>} />
            <Route path="/watch/:movieId" element={<RequireAuth><SoloWatch /></RequireAuth>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--bg3)',
              color:      'var(--text)',
              border:     '0.5px solid var(--border2)',
              fontSize:   '13.5px',
            },
            success: { iconTheme: { primary: '#4caf50', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#e53935', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}