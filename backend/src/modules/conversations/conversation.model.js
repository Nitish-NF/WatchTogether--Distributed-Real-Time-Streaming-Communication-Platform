const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['dm', 'group'],
      default: 'dm',
    },

    name: { type: String, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    participants: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        username: String,
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    lastMessage: {
      text: String,
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      type: {
        type: String,
        enum: ['text', 'movie', 'party'],
        default: 'text',
      },
      createdAt: Date,
    },

    // Per-participant unread counts: { userId: count }
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    /**
     * isRequest — NEW
     * false (default) — normal DM, appears in main conversation list.
     * true            — started by a public stranger with no follow relationship.
     *                   Appears in the "Message Requests" section.
     *                   Recipient can accept (sets false) or decline (deleted).
     */
    isRequest: { type: Boolean, default: false },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

conversationSchema.index({ 'participants._id': 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ 'participants._id': 1, isRequest: 1 }); // for split queries

module.exports = mongoose.model('Conversation', conversationSchema);