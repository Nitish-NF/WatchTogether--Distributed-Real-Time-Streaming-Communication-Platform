const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  fromUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:       { type: String, enum: ['movie', 'party'], required: true },
  movieId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
  movieTitle: { type: String },
  roomId:     { type: mongoose.Schema.Types.ObjectId, ref: 'WatchParty' },
  seen:       { type: Boolean, default: false },

  /**
   * isRequest — NEW
   * false (default) — sender has a follow relationship with recipient.
   *                   Appears directly in their Feed.
   * true            — sender is a public stranger (no follow relationship).
   *                   Goes to recipient's "Requests" tab in Feed.
   *                   Recipient can accept (moves to Feed) or decline (deleted).
   */
  isRequest:  { type: Boolean, default: false },

}, { timestamps: true });

shareSchema.index({ toUser: 1, createdAt: -1 });
shareSchema.index({ toUser: 1, isRequest: 1 });   // for getRequests query
shareSchema.index({ fromUser: 1 });

module.exports = mongoose.model('Share', shareSchema);