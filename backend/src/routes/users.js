const express = require('express');
const mongoose = require('mongoose');
const Cuisine = require('../models/Cuisine');
const { requireAuth, httpError } = require('../middleware/auth');
const { signToken, needsRenewal } = require('../services/tokens');

const router = express.Router();

// Profil. Si le jeton a plus de 7 jours, on en renvoie un neuf : la session se prolonge à chaque ouverture de l'appli.
router.get('/me', requireAuth, (req, res) => {
  const renewed = req.tokenPayload && needsRenewal(req.tokenPayload) ? { token: signToken(req.user) } : {};
  res.json({ user: req.user, ...renewed });
});

const PRICE_RE = /^€{1,4}$/;
const unique = (list) => [...new Set(list)];

// Remplace les préférences (cuisines, budgets, tags) servant à personnaliser le fil
router.put('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    const { cuisines = [], price_ranges: prices = [], tags = [] } = req.body || {};
    if (![cuisines, prices, tags].every(Array.isArray)) throw httpError(400, 'cuisines, price_ranges and tags must be arrays');
    if (cuisines.length > 20 || tags.length > 20 || prices.length > 4) throw httpError(400, 'too many values');
    if (!cuisines.every((id) => mongoose.isValidObjectId(id))) throw httpError(400, 'invalid cuisine id');
    if (!prices.every((p) => typeof p === 'string' && PRICE_RE.test(p))) throw httpError(400, 'price_ranges must look like € to €€€€');
    if (!tags.every((t) => typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= 30)) {
      throw httpError(400, 'each tag must be 1 to 30 characters');
    }

    const existing = await Cuisine.find({ _id: { $in: cuisines } }).select('_id').lean();
    req.user.set('preferences', {
      cuisines: existing.map((c) => c._id),
      price_ranges: unique(prices),
      tags: unique(tags.map((t) => t.trim().toLowerCase())),
    });
    await req.user.save();
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;