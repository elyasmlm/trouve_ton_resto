const Notification = require('../models/Notification');

// Crée des notifications sans jamais faire échouer l'action qui les déclenche (invitation, modération...)
async function notify(userIds, type, message, data) {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((user) => ({ user, type, message: message.slice(0, 300), data })));
  } catch (err) {
    console.warn('Notification not created:', err.message);
  }
}

module.exports = { notify };
