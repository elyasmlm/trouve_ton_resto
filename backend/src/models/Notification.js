const mongoose = require('mongoose');

const TYPES = ['list_invite', 'resto_verified', 'resto_rejected', 'content_removed', 'new_review'];

// Notification affichée dans la cloche d'un utilisateur ; créée par services/notifications.js
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed }, // ex. { resto: ObjectId, list: ObjectId }
  },
  { collection: 'notifications', timestamps: { createdAt: 'created_at', updatedAt: false } }
);
notificationSchema.index({ user: 1, read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
