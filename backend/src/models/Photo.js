const mongoose = require('mongoose');

// Photo d'un resto : fichier envoyé par l'utilisateur (/uploads/..., traité par services/images.js)
// ou, pour un admin, lien vers une image / vidéo externe.
const LINK = /^(https?:\/\/\S+|\/uploads\/[\w.-]+)$/i;

const photoSchema = new mongoose.Schema(
  {
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true, trim: true, maxlength: 2000, match: [LINK, 'url must be an http(s) link or an uploaded file'] },
    thumb: { type: String, trim: true, maxlength: 2000, match: [LINK, 'thumb must be an http(s) link or an uploaded file'] },
    caption: { type: String, trim: true, maxlength: 300 },
  },
  { collection: 'photos', timestamps: { createdAt: 'created_at', updatedAt: false } }
);
photoSchema.index({ resto: 1, created_at: -1 });

module.exports = mongoose.model('Photo', photoSchema);