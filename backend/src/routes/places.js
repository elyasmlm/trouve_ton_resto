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

// GET /api/places/search?name=Le Procope&city=Paris[&lat=48.85&lng=2.34]   (ou l'ancien ?q=Le Procope Paris)
router.get('/search', requireAuth, limit, async (req, res, next) => {
  try {
    const text = (v) => (typeof v === 'string' ? v : '');
    const number = (v, min, max) => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, 'lat or lng is invalid');
      return n;
    };
    const lat = number(req.query.lat, -90, 90);
    const lng = number(req.query.lng, -180, 180);
    if ((lat === undefined) !== (lng === undefined)) throw httpError(400, 'lat and lng must be given together');
    const name = text(req.query.name) || text(req.query.q);
    res.json({ items: await searchPlaces({ name, city: text(req.query.city), lat, lng }) });
  } catch (err) {
    next(err);
  }
});

router.resetLimits = () => hits.clear();

module.exports = router;