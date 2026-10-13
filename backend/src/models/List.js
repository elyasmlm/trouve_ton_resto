const mongoose = require('mongoose');

const TYPES = ['wishlist', 'eatenlist', 'custom'];

const listSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // propriétaire
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    type: { type: String, enum: TYPES, required: true, default: 'custom' },
    restos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resto' }],
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    is_public: { type: Boolean, default: false },
  },
  { collection: 'lists', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
listSchema.index({ user: 1, name: 1 }, { unique: true });
listSchema.index({ collaborators: 1 });

module.exports = mongoose.model('List', listSchema);
module.exports.TYPES = TYPES;