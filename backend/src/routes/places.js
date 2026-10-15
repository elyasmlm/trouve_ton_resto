const express = require('express');
const { requireAuth, httpError } = require('../middleware/auth');
const { searchPlaces } = require('../services/places');

const router = express.Router();

// 20 recherches par minute et par utilisateur (en plus de la cadence globale de 1 requête/s vers OpenStreetMap)
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function limit(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(String(req.user._id)) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return next(httpError(429, 'Too many searches, try again in a minute'));
  recent.push(now);
  hits.set(String(req.user._id), recent);
  next();
}

router.get('/search', requireAuth, limit, async (req, res, next) => {
  try {
    res.json({ items: await searchPlaces(req.query.q) });
  } catch (err) {
    next(err);
  }
});

router.resetLimits = () => hits.clear();

module.exports = router;