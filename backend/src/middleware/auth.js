const jwt = require('jsonwebtoken');
const User = require('../models/User');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function requireAuth(req, res, next) {
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

module.exports = { requireAuth, requireRole, httpError };