const mongoose = require('mongoose');

// Les fichiers ne sont pas hébergés ici : on stocke l'URL d'une image déjà en ligne.
const photoSchema = new mongoose.Schema(
  {
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true, trim: true, maxlength: 2000, match: [/^https?:\/\/\S+$/i, 'url must be an http(s) link'] },
    caption: { type: String, trim: true, maxlength: 300 },
  },
  { collection: 'photos', timestamps: { createdAt: 'created_at', updatedAt: false } }
);
photoSchema.index({ resto: 1, created_at: -1 });

module.exports = mongoose.model('Photo', photoSchema);