const jwt = require('jsonwebtoken');
const User = require('../models/User');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function bearerToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Identifie l'utilisateur quand un token valide est fourni, sinon continue en anonyme (jamais d'erreur)
async function attachUser(req, res, next) {
  try {
    const token = bearerToken(req);
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = (await User.findById(payload.sub)) || undefined;
    }
  } catch {
    /* token absent ou invalide : visiteur anonyme */
  }
  next();
}

async function requireAuth(req, res, next) {
  if (req.user) return next();
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw httpError(401, 'Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw httpError(401, 'Invalid or expired token');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, 'Forbidden'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, attachUser, httpError };