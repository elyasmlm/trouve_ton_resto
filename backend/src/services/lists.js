const List = require('../models/List');

const DEFAULTS = [
  ['wishlist', 'Ma wishlist'],
  ['eatenlist', 'Déjà testés'],
];

// Crée la wishlist et la liste « déjà testés » si elles manquent (idempotent, sans danger en parallèle)
async function ensureDefaultLists(userId) {
  for (const [type, name] of DEFAULTS) {
    try {
      await List.updateOne({ user: userId, type }, { $setOnInsert: { user: userId, type, name, restos: [], collaborators: [], is_public: false } }, { upsert: true });
    } catch (err) {
      if (err.code !== 11000) throw err; // créée au même instant par une autre requête
    }
  }
}

module.exports = { ensureDefaultLists };