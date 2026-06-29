const partyService = require('../watchparty/party.service.js');

/**
 * Handles all sync-related socket events.
 * Only the verified room host (from DB) is allowed to drive sync.
 */

const VALID_ACTIONS = ['play', 'pause', 'seek'];
const SEEK_THROTTLE_MS = 10_000;

// Cache hostId per room to avoid a DB round-trip on every play/pause/seek.
// Populated on first sync, invalidated when the room closes (clearRoom).
const _hostCache = new Map();

const syncService = {

  /**
   * _lastSave: Map<roomId, timestamp>
   * Used to throttle seek DB writes. Stored as a Map to avoid prototype pollution.
   */
  _lastSave: new Map(),

  handleSyncEvent: async (io, socket, data) => {
    try {
      const { roomId, event } = data || {};

      // ── 1. Basic shape check ─────────────────────────────────────
      if (!roomId || !event) return;

      // ── 2. Auth guard: reject unauthenticated sockets ─────────────
      if (!socket.user?._id) {
        console.warn('[Sync] Unauthenticated socket attempted sync — ignored');
        return;
      }

      // ── 3. Room membership: socket must actually be in this room ──
      if (!socket.rooms.has(roomId)) {
        console.warn(`[Sync] Socket ${socket.id} not in room ${roomId} — ignored`);
        return;
      }

      // ── 4. Validate action and time ───────────────────────────────
      const { action, time } = event;

      if (!VALID_ACTIONS.includes(action)) {
        console.warn(`[Sync] Invalid action "${action}" — ignored`);
        return;
      }

      if (typeof time !== 'number' || !isFinite(time) || time < 0) {
        console.warn(`[Sync] Invalid time value "${time}" — ignored`);
        return;
      }

      // ── 5. Verify host from DB (never trust client-supplied hostId) ─
      // Use cached hostId to avoid a DB hit on every play/pause/seek.
      let hostId = _hostCache.get(roomId);
      if (!hostId) {
        const room = await partyService.getRoom(roomId);
        if (!room) {
          console.warn(`[Sync] Room ${roomId} not found`);
          return;
        }
        // hostId is populated as an object { _id, username } — extract the raw id
        hostId = (room.hostId?._id ?? room.hostId).toString();
        _hostCache.set(roomId, hostId);
      }

      if (socket.user._id.toString() !== hostId) {
        console.warn(
          `[Sync] Non-host "${socket.user?.username}" tried to emit sync in room ${roomId} — ignored`
        );
        return;
      }

      // ── 6. Persist sync state to DB ───────────────────────────────
      // Always save play/pause (state changes); throttle seek writes only.
      const now = Date.now();
      const lastSave = syncService._lastSave.get(roomId) ?? 0;
      const shouldThrottle = action === 'seek';

      if (!shouldThrottle || now - lastSave > SEEK_THROTTLE_MS) {
        syncService._lastSave.set(roomId, now);
        await partyService.saveSyncState(roomId, action, time).catch((err) => {
          console.error('[Sync] Failed to save sync state:', err.message);
        });
      }

      // ── 7. Broadcast to everyone else in the room ─────────────────
      // Only forward validated, sanitised fields — never re-broadcast raw event object
      socket.to(roomId).emit('sync_event', { action, time });

    } catch (err) {
      console.error('[Sync] Unexpected error in handleSyncEvent:', err);
    }
  },

  /**
   * Call this when a room is closed/deleted to free memory.
   */
  clearRoom: (roomId) => {
    syncService._lastSave.delete(roomId);
    _hostCache.delete(roomId);
  },

  /**
   * Optional: periodically prune stale entries so _lastSave
   * doesn't grow if clearRoom is missed (e.g. after a crash).
   * Call this on an interval: setInterval(syncService.pruneStale, 60_000)
   */
  pruneStale: () => {
    const cutoff = Date.now() - 5 * 60_000; // 5 minutes
    for (const [roomId, ts] of syncService._lastSave.entries()) {
      if (ts < cutoff) syncService._lastSave.delete(roomId);
    }
  },
};

module.exports = syncService;