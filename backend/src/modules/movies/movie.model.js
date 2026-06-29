const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  genre:       { type: String, required: true },
  year:        { type: Number },
  duration:    { type: Number }, // seconds
  director:    { type: String },
  cast:        [String],
  language:    { type: String, default: 'English' },
  thumbnail:   { type: String, default: '' },
  // Gradient fallback color when no thumbnail
  color:       { type: String, default: '#1a237e' },
  // HLS stream URL (relative or absolute)
  streamUrl:   { type: String, default: '' },
  isTrending:  { type: Boolean, default: false },
  isNew:       { type: Boolean, default: false },
  viewCount:   { type: Number, default: 0 },
  tags:        [String],
}, { timestamps: true });

movieSchema.index({ title: 'text', genre: 'text', cast: 'text' });

module.exports = mongoose.model('Movie', movieSchema);