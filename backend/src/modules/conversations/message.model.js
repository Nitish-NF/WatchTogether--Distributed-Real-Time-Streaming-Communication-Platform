const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    senderUsername: String,

    type: {
      type: String,
      enum: ['text', 'movie', 'party'],
      default: 'text',
    },

    text: String,

    // Movie share
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
    },
    movieTitle: String,
    // Party invite
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WatchParty',
    },

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);