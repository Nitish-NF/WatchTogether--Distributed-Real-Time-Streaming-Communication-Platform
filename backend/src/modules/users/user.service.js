const User          = require('./user.model.js');
const followService = require('../follow/follow.service.js');
const { getIO }     = require('../../websocket/socketStore.js');

const userService = {

  getProfile: async (userId) => {
    const user = await User.findById(userId).select('-password -email');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
  },

  /**
   * updateProfile
   * ─────────────
   * Allowed fields:
   *   bio, avatar    — original
   *   name           — display name (50 chars max)
   *   isPrivate      — privacy toggle
   *
   * Username is intentionally NOT editable via this endpoint.
   *
   * After saving, emits `profile:updated` via Socket.IO so any browser
   * currently viewing this profile page refreshes the data in real-time.
   */
  updateProfile: async (userId, updates) => {
    const allowed  = ['bio', 'avatar', 'name', 'isPrivate'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    // ── name trim & length check ──────────────────────────────────
    if (filtered.name !== undefined) {
      filtered.name = filtered.name.trim();
      if (filtered.name.length > 50) {
        throw Object.assign(new Error('Display name must be 50 characters or less'), { statusCode: 422 });
      }
    }

    const updated = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true })
      .select('-password');

    // ── Real-time broadcast ───────────────────────────────────────
    // Emit only the fields that actually changed so the frontend can
    // do a shallow merge without blowing away unrelated local state.
    const io = getIO();
    if (io && Object.keys(filtered).length > 0) {
      io.emit('profile:updated', {
        userId:  userId.toString(),
        updates: filtered,
      });
    }

    return updated;
  },

  getWatchHistory: async (userId) => {
    const user = await User.findById(userId)
      .select('profiles activeProfile')
      .populate('profiles.watchHistory.movie', 'title genre year thumbnail color duration');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const profile = user.profiles[user.activeProfile || 0];
    return (profile?.watchHistory || [])
      .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
      .slice(0, 50);
  },

  saveProgress: async (userId, movieId, progress) => {
    const user = await User.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const profile = user.profiles[user.activeProfile || 0];
    if (!profile) return;
    const existing = profile.watchHistory.find(
      h => h.movie?.toString() === movieId.toString()
    );
    if (existing) {
      existing.progress  = progress;
      existing.watchedAt = new Date();
    } else {
      profile.watchHistory.unshift({ movie: movieId, progress, watchedAt: new Date() });
      if (profile.watchHistory.length > 100) profile.watchHistory.pop();
    }
    user.markModified('profiles');
    await user.save();
  },

  /**
   * searchUsers
   * ───────────
   * Returns ALL matching users (public and private) — anyone is discoverable.
   * Attaches canContact / contactMode flags per result.
   */
  searchUsers: async (query, requesterId = null) => {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = {
      $or: [
        { username: { $regex: escaped, $options: 'i' } },
        { name:     { $regex: escaped, $options: 'i' } },
      ],
      ...(requesterId ? { _id: { $ne: requesterId } } : {}),
    };

    const users = await User.find(filter)
      .select('username name avatar bio followersCount isPrivate')
      .limit(20)
      .lean();

    if (!users.length) return [];

    if (!requesterId) {
      return users.map(u => ({
        ...u,
        canContact:  !u.isPrivate,
        contactMode: u.isPrivate ? 'locked' : 'request',
      }));
    }

    const [followers, following] = await Promise.all([
      followService.getFollowers(requesterId),
      followService.getFollowing(requesterId),
    ]);

    const theyFollowMe = new Set(followers.map(u => u._id.toString()));
    const iFollowThem  = new Set(following.map(u => u._id.toString()));

    return users.map(u => {
      const id        = u._id.toString();
      const connected = theyFollowMe.has(id) || iFollowThem.has(id);

      let canContact, contactMode;
      if (connected)         { canContact = true;  contactMode = 'direct';  }
      else if (!u.isPrivate) { canContact = true;  contactMode = 'request'; }
      else                   { canContact = false; contactMode = 'locked';  }

      return { ...u, canContact, contactMode };
    });
  },
};

module.exports = userService;