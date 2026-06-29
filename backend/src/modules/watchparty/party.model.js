const mongoose = require('mongoose');

const watchPartySchema = new mongoose.Schema({
  movieId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  movieTitle:   { type: String },
  streamUrl:    { type: String },
  roomName:     { type: String },
  hostId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
  participants: [{
    _id:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username:   String,
    joinedAt:   { type: Date, default: Date.now },
    audioMuted: { type: Boolean, default: false },
    videopaused: { type: Boolean, default: false },
  }],
  isPrivate:    { type: Boolean, default: false },
  isLocked:     { type: Boolean, default: false },
  active:       { type: Boolean, default: true },
  // Last known playback state
  syncState: {
    action:    { type: String, enum: ['play', 'pause', 'seek'], default: 'pause' },
    time:      { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  participantCount: { type: Number, default: 1 },
  endedAt:{ type: Date},
  hostDisconnectedAt:{ type: Date}
}, { timestamps: true });

watchPartySchema.index({ active: 1, isPrivate: 1 });
watchPartySchema.index({ hostId: 1 });

module.exports = mongoose.model('WatchParty', watchPartySchema);