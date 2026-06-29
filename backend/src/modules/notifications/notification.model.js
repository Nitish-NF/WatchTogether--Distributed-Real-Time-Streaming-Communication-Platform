const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'follow_request',
        'follow_accepted',
        'new_follower',
        'movie_share',
        'movie_share_request',   // NEW — public stranger shared a movie
        'party_invite',
        'party_invite_request',  // NEW — public stranger invited to party
        'join_alert',
      ],
      required: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WatchParty',
    },

    /**
     * shareId — NEW
     * Links the notification back to the Share doc so the frontend
     * can call acceptRequest / declineRequest with the correct ID
     * when the user taps Accept or Decline on a share request.
     */
    shareId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Share',
    },

    message: { type: String, required: true },
    read:    { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);