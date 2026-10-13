const jwt = require('jsonwebtoken');

// Sessions longues : le jeton dure 180 jours et est prolongé à l'ouverture de l'appli s'il a plus de 7 jours.
// Un utilisateur régulier n'a donc quasiment jamais à se reconnecter ; un compte abandonné finit par expirer.
const RENEW_AFTER_SECONDS = 7 * 24 * 3600;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, v: user.token_version || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '180d',
  });
}

const needsRenewal = (payload) => Math.floor(Date.now() / 1000) - payload.iat > RENEW_AFTER_SECONDS;

module.exports = { signToken, needsRenewal };