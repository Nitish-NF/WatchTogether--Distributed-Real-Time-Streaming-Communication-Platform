const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Prevent duplicate follow entries
followSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema);