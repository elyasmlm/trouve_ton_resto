const express = require('express');
const User = require('../models/User');
const { httpError, requireAuth } = require('../middleware/auth');
const { signToken } = require('../services/tokens');
const { ensureDefaultLists } = require('../services/lists');

const router = express.Router();

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


router.post('/register', async (req, res, next) => {
  try {
    const { username, mail, password } = req.body || {};
    if (typeof username !== 'string' || username.trim().length < 3) {
      throw httpError(400, 'username must be at least 3 characters');
    }
    if (typeof mail !== 'string' || !MAIL_RE.test(mail)) {
      throw httpError(400, 'mail is invalid');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw httpError(400, 'password must be at least 8 characters');
    }

    // role is never taken from the request: everybody starts as a plain user
    const user = await User.create({ username, mail, password });
    await ensureDefaultLists(user._id).catch(() => {}); // sinon créées au premier accès à /api/lists
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === 11000) return next(httpError(409, 'username or mail already used'));
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { mail, password } = req.body || {};
    if (typeof mail !== 'string' || typeof password !== 'string') {
      throw httpError(400, 'mail and password are required');
    }
    const user = await User.findOne({ mail: mail.trim().toLowerCase() }).select('+password');
    if (!user || !(await user.checkPassword(password))) {
      throw httpError(401, 'Invalid credentials');
    }
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// « Se déconnecter de tous les appareils » : tous les jetons déjà émis deviennent invalides
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { token_version: 1 } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;