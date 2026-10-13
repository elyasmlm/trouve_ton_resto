const jwt = require('jsonwebtoken');
const User = require('../models/User');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function bearerToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Vérifie la signature, la date et la « version » du jeton (augmentée par « se déconnecter partout »)
async function authenticate(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub);
  if (!user || (payload.v || 0) !== (user.token_version || 0)) return null;
  return { user, payload };
}

// Identifie l'utilisateur quand un token valide est fourni, sinon continue en anonyme (jamais d'erreur)
async function attachUser(req, res, next) {
  try {
    const token = bearerToken(req);
    const session = token && (await authenticate(token));
    if (session) {
      req.user = session.user;
      req.tokenPayload = session.payload;
    }
  } catch {
    /* token absent, expiré ou invalide : visiteur anonyme */
  }
  next();
}

async function requireAuth(req, res, next) {
  if (req.user) return next();
  try {
    const token = bearerToken(req);
    if (!token) throw httpError(401, 'Authentication required');
    let session;
    try {
      session = await authenticate(token);
    } catch {
      session = null;
    }
    if (!session) throw httpError(401, 'Invalid or expired token');
    req.user = session.user;
    req.tokenPayload = session.payload;
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