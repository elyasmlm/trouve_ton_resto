const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: [(v) => (v * 2) % 1 === 0, 'rating must be a multiple of 0.5'],
    },
    comment: { type: String, trim: true, maxlength: 2000 },
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true, default: Date.now },
    // Réponse publique du restaurateur (ou d'un admin) : une seule par avis
    reply: {
      text: { type: String, trim: true, minlength: 1, maxlength: 1000 },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: Date,
    },
  },
  { collection: 'reviews' }
);
reviewSchema.index({ resto: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);