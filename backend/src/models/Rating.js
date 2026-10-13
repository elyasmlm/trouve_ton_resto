const mongoose = require('mongoose');

// Source de vérité des notes : une ligne par (resto, source). restos.rating en est un résumé.
const ratingSchema = new mongoose.Schema(
  {
    value: { type: Number, required: true, min: 0, max: 5 },
    source: { type: String, required: true }, // google, tripadvisor, inside...
    date: { type: Date, required: true, default: Date.now },
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true },
    total_reviews: Number,
  },
  { collection: 'ratings' }
);
ratingSchema.index({ resto: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);