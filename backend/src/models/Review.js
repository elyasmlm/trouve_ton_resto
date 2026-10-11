const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    rating: { type: Number, required: true, min: 0, max: 5 },
    comment: String,
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true, default: Date.now },
  },
  { collection: 'reviews' }
);
reviewSchema.index({ resto: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);