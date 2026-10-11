const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../middleware/auth');

const router = express.Router();

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

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

module.exports = router;