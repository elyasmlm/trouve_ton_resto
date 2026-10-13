const express = require('express');
const Rating = require('../models/Rating');
const loadResto = require('../middleware/loadResto');
const { requireAuth, requireRole, httpError } = require('../middleware/auth');
const { setSourceRating, EXTERNAL_SOURCES } = require('../services/ratings');

const router = express.Router({ mergeParams: true });

router.get('/', loadResto, async (req, res, next) => {
  try {
    res.json({ items: await Rating.find({ resto: req.resto._id }).lean() });
  } catch (err) {
    next(err);
  }
});

// Note venant d'une source externe (la note « inside » est calculée à partir des avis)
router.put('/:source', requireAuth, requireRole('admin'), loadResto, async (req, res, next) => {
  try {
    const { source } = req.params;
    if (!EXTERNAL_SOURCES.includes(source)) {
      throw httpError(400, `source must be one of ${EXTERNAL_SOURCES.join(', ')}`);
    }
    const { value, total_reviews: total } = req.body || {};
    if (typeof value !== 'number' || value < 0 || value > 5) throw httpError(400, 'value must be a number between 0 and 5');
    if (total !== undefined && !Number.isInteger(total)) throw httpError(400, 'total_reviews must be an integer');
    await setSourceRating(req.resto._id, source, value, total);
    res.json({ rating: await Rating.findOne({ resto: req.resto._id, source }).lean() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;