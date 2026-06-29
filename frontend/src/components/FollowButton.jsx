import React, { useState, useEffect, useRef } from 'react';
import { followService } from '../services/followService';
import toast from 'react-hot-toast';

/**
 * FollowButton — self-contained, syncs with parent via onStatusChange.
 *
 * Status values:
 *   'none'         – no relationship
 *   'following'    – I follow them
 *   'follow_back'  – they follow me, I don't follow back
 *   'mutual_follow'– both follow each other
 *   'requested'    – I sent a pending request (private user)
 *   'accept'       – they sent me a request → show Accept / Decline
 */
export default function FollowButton({
  targetUserId,
  targetUsername,
  initialStatus = 'none',
  onStatusChange,
  size = 'sm',
}) {
  const [status,        setStatus]        = useState(initialStatus);
  const [loadingAction, setLoadingAction] = useState(null); // null | 'main' | 'accept' | 'decline'

  // Track internal status so the initialStatus sync guard works correctly
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // BUG FIX 4: Only sync from parent when the value actually differs from
  // current internal state. This prevents the parent overwriting an
  // optimistic update when it re-renders with a stale initialStatus prop.
  useEffect(() => {
    if (initialStatus !== statusRef.current) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const apply = (newStatus) => {
    setStatus(newStatus);
    statusRef.current = newStatus;
    onStatusChange?.(newStatus);
  };

  // BUG FIX 1 + general: run now accepts either a static successStatus string
  // OR an async apiFn that returns the success status dynamically.
  // This lets sendRequest decide 'following' vs 'requested' based on the
  // server response (public user → accepted immediately, private → pending).
  const run = async (apiFn, actionKey) => {
    if (loadingAction) return;
    setLoadingAction(actionKey);
    try {
      const result = await apiFn();
      // If apiFn returns a string, treat it as the new status.
      // Otherwise the caller must have already called apply() inside apiFn.
      if (typeof result === 'string') {
        apply(result);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoadingAction(null);
    }
  };

  // ── Accept / Decline block (they requested me) ────────────────
  // BUG FIX 2: separate loadingAction keys so each button has its own
  //            loading state — clicking Accept doesn't change Decline's text.
  // BUG FIX 3: Accepting means THEY follow ME — so the result is 'follow_back',
  //            not 'mutual_follow' (that would require me to already follow them,
  //            which can't be true while status is 'accept').
  if (status === 'accept') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-red btn-${size}`}
            disabled={!!loadingAction}
            onClick={() => run(
              async () => { await followService.accept(targetUserId); return 'follow_back'; },
              'accept'
            )}
          >
            {loadingAction === 'accept' ? '…' : 'Accept'}
          </button>
          <button
            className={`btn btn-ghost btn-${size}`}
            disabled={!!loadingAction}
            onClick={() => run(
              async () => { await followService.reject(targetUserId); return 'none'; },
              'decline'
            )}
          >
            {loadingAction === 'decline' ? '…' : 'Decline'}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
          <strong style={{ color: 'var(--text)' }}>{targetUsername}</strong> sent you a request
        </div>
      </div>
    );
  }

  const handleClick = () => {
    switch (status) {
      case 'none':
      case 'follow_back':
        // BUG FIX 1: public users get auto-accepted on the backend and return
        // status:'accepted'. Use the API response to decide the next status
        // instead of always assuming 'requested'.
        return run(async () => {
          const res = await followService.sendRequest(targetUserId);
          return res?.status === 'accepted' ? 'following' : 'requested';
        }, 'main');

      case 'requested':
        return run(async () => {
          await followService.cancelRequest(targetUserId);
          return 'none';
        }, 'main');

      case 'following':
      case 'mutual_follow': {
        const ok = window.confirm(`Unfollow ${targetUsername}?`);
        if (!ok) return;
        const nextStatus = status === 'mutual_follow' ? 'follow_back' : 'none';
        return run(async () => {
          await followService.unfollow(targetUserId);
          return nextStatus;
        }, 'main');
      }

      default:
        return;
    }
  };

  // ── Label + style config ──────────────────────────────────────
  const cfg = {
    none:          { label: 'Follow',      cls: 'btn-red'   },
    follow_back:   { label: 'Follow Back', cls: 'btn-red'   },
    requested:     { label: 'Requested',   cls: 'following' },
    following:     { label: 'Following',   cls: 'following' },
    mutual_follow: { label: 'Friends',     cls: 'following' },
  };

  const { label, cls } = cfg[status] || cfg.none;

  return (
    <button
      className={`btn btn-${size} follow-btn ${cls}`}
      onClick={handleClick}
      disabled={!!loadingAction}
      style={{ minWidth: '100px' }}
    >
      {loadingAction === 'main' ? '…' : label}
    </button>
  );
}