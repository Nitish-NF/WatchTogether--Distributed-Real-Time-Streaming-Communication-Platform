import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/followService';
import { formatDistanceToNow } from 'date-fns';
import socket from '../sockets/socket';

const TYPE_META = {
  follow_request:  { icon: '👤', bg: '#4a148c', label: 'Follow Request'  },
  new_follower:    { icon: '👤', bg: '#1a237e', label: 'New Follower'    },
  follow_accepted: { icon: '✅', bg: '#006064', label: 'Follow Accepted' },
  movie_share:     { icon: '🎬', bg: '#1a237e', label: 'Movie Shared'    },
  party_invite:    { icon: '🎉', bg: '#b71c1c', label: 'Party Invite'    },
  join_alert:      { icon: '🚪', bg: '#1b5e20', label: 'Someone Joined'  },
};

export default function NotificationBell() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const ref      = useRef(null);
  const navigate = useNavigate();

  // ── Initial fetch ────────────────────────────────────────────────
  useEffect(() => {
    notificationService.getNotifications()
      .then(data => {
        setNotifications(data || []);
        setUnread((data || []).filter(n => !n.read).length);
      })
      .catch(() => {});
  }, []);

  // ── Real-time ────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnread(prev => prev + 1);
    };
    socket.on('notification', handle);
    return () => socket.off('notification', handle);
  }, []);

  // ── Close on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Mark single read + navigate ──────────────────────────────────
  const handleClick = async (notif) => {
    if (!notif.read) {
      await notificationService.markRead(notif._id).catch(() => {});
      setNotifications(prev =>
        prev.map(n => n._id === notif._id ? { ...n, read: true } : n)
      );
      setUnread(prev => Math.max(0, prev - 1));
    }
    setOpen(false);

    if (notif.type === 'party_invite' && notif.roomId) {
      navigate(`/party/${notif.roomId}`);
    } else if (notif.type === 'movie_share' && notif.movieId) {
      navigate(`/movie/${notif.movieId}`);
    } else if (
      (notif.type === 'follow_request'  ||
       notif.type === 'follow_accepted' ||
       notif.type === 'new_follower')   && notif.fromUser
    ) {
      navigate(`/profile/${notif.fromUser._id || notif.fromUser}`);
    }
  };

  // ── Mark all read ────────────────────────────────────────────────
  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await notificationService.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  // ── Join party from notification ─────────────────────────────────
  const handleJoinParty = (e, roomId) => {
    e.stopPropagation();
    setOpen(false);
    navigate(`/party/${roomId}`);
  };

  const meta = (type) => TYPE_META[type] || { icon: '🔔', bg: '#333', label: 'Notification' };

  return (
    <div className="notif-bell-wrapper" ref={ref}>

      {/* Bell button */}
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="notif-badge">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notif-dropdown">

          {/* Header */}
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all-btn" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-icon">🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 12).map(notif => {
                const { icon, bg } = meta(notif.type);
                const isPartyInvite = notif.type === 'party_invite' && notif.roomId;

                return (
                  <div
                    key={notif._id}
                    onClick={() => handleClick(notif)}
                    className={`notif-item${!notif.read ? ' unread' : ''}`}
                  >
                    {/* Icon */}
                    <div className="notif-icon" style={{ background: bg }}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="notif-content">
                      <div className="notif-text">
                        {notif.fromUser?.username && (
                          <strong>{notif.fromUser.username}{' '}</strong>
                        )}
                        {notif.message}
                      </div>
                      <div className="notif-time">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </div>

                      {isPartyInvite && (
                        <button
                          className="btn btn-red btn-sm notif-join-btn"
                          onClick={(e) => handleJoinParty(e, notif.roomId)}
                        >
                          Join Party
                        </button>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!notif.read && <div className="notif-unread-dot" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 12 && (
            <div className="notif-footer">
              <button
                className="btn btn-ghost btn-sm notif-see-all-btn"
                onClick={() => { navigate('/notifications'); setOpen(false); }}
              >
                See all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}