const mongoose = require('mongoose');

const TYPES = ['resto', 'photo', 'review'];
const REASONS = ['inaccurate', 'closed', 'duplicate', 'inappropriate', 'spam', 'copyright', 'other'];

// Signalement d'un contenu par un utilisateur, traité par un admin (voir routes/admin.js)
const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true }, // le resto, la photo ou l'avis signalé
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true }, // le resto concerné (contexte)
    reason: { type: String, enum: REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolution: { type: String, enum: ['removed', 'dismissed'] },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolved_at: Date,
  },
  { collection: 'reports', timestamps: { createdAt: 'created_at', updatedAt: false } }
);
reportSchema.index({ reporter: 1, type: 1, target: 1 }, { unique: true }); // un seul signalement par personne et par contenu
reportSchema.index({ status: 1, created_at: 1 });
reportSchema.index({ type: 1, target: 1, status: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.TYPES = TYPES;
module.exports.REASONS = REASONS;