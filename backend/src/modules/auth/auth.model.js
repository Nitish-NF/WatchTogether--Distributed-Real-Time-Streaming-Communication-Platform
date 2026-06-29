const mongoose = require('mongoose');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, minlength: 3, maxlength: 30,
  },
  email: {
    type: String, required: true, unique: true,
    lowercase: true, trim: true,
  },
  password: {
    type: String, required: true, minlength: 6,
  },
  bio:    { type: String, maxlength: 200, default: '' },
  avatar: { type: String, default: '' },
  profiles: [{
    name:         { type: String, required: true },
    avatar:       { type: String, default: '' },
    watchHistory: [{
      movie:     { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
      progress:  Number,
      watchedAt: Date,
    }],
    preferences:  { genres: [String] },
  }],
  activeProfile: { type: Number, default: 0 },

  followers:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  affinityScores: [{
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: { type: Number, default: 0 },
  }],
  peerPreferences: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followersCount:  { type: Number, default: 0 },
  followingCount:  { type: Number, default: 0 },
  isPrivate:       { type: Boolean, default: false },

  // ── Refresh token family ─────────────────────────────────────────
  // Each entry represents one active session (one device/browser).
  // tokenHash  — SHA-256 of the raw refresh token (never store raw)
  // deviceName — user-agent snippet shown in "Active Sessions" UI
  // createdAt  — when the session was first created (login time)
  // lastUsed   — updated on every silent refresh (shows last activity)
  refreshTokens: [{
    tokenHash:  { type: String, required: true },
    deviceName: { type: String, default: 'Unknown device' },
    createdAt:  { type: Date,   default: Date.now },
    lastUsed:   { type: Date,   default: Date.now },
  }],

  // ── Password reset ───────────────────────────────────────────────
  passwordResetToken:   { type: String },
  passwordResetExpires: { type: Date },
}, { timestamps: true });

// ── Hooks ────────────────────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Methods ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Generate a random reset token (plain), store its SHA-256 hash,
 * set a 1-hour expiry, and return the plain token to be emailed.
 */
userSchema.methods.createPasswordResetToken = function () {
  const plain  = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(plain).digest('hex');

  this.passwordResetToken   = hashed;
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  return plain;
};

userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;          // never expose session hashes to client
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
