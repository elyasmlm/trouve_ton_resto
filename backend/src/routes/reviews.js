const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const loadResto = require('../middleware/loadResto');
const { requireAuth, httpError } = require('../middleware/auth');
const { recomputeInsideRating } = require('../services/ratings');
const { pageParams, pageResult } = require('../utils/pagination');

const router = express.Router({ mergeParams: true });

async function loadReview(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.reviewId)) throw httpError(404, 'Review not found');
    const review = await Review.findOne({ _id: req.params.reviewId, resto: req.resto._id });
    if (!review) throw httpError(404, 'Review not found');
    req.review = review;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuthorOrAdmin(req, res, next) {
  if (req.user.role !== 'admin' && !req.review.user.equals(req.user._id)) return next(httpError(403, 'Forbidden'));
  next();
}

router.get('/', loadResto, async (req, res, next) => {
  try {
    const p = pageParams(req.query);
    const filter = { resto: req.resto._id };
    const [items, total] = await Promise.all([
      Review.find(filter).sort({ date: -1, _id: 1 }).skip(p.skip).limit(p.limit).populate('user', 'username').lean(),
      Review.countDocuments(filter),
    ]);
    res.json(pageResult(items, total, p));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, loadResto, async (req, res, next) => {
  try {
    if ((req.user.restos || []).some((id) => id.equals(req.resto._id))) {
      throw httpError(403, 'You cannot review your own resto');
    }
    const { rating, comment } = req.body || {};
    const review = await Review.create({ resto: req.resto._id, user: req.user._id, rating, comment, date: new Date() });
    await recomputeInsideRating(req.resto._id);
    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000) return next(httpError(409, 'You already reviewed this resto'));
    next(err);
  }
});

router.patch('/:reviewId', requireAuth, loadResto, loadReview, requireAuthorOrAdmin, async (req, res, next) => {
  try {
    const { rating, comment } = req.body || {};
    if (rating !== undefined) req.review.rating = rating;
    if (comment !== undefined) req.review.comment = comment;
    await req.review.save();
    await recomputeInsideRating(req.resto._id);
    res.json({ review: req.review });
  } catch (err) {
    next(err);
  }
});

router.delete('/:reviewId', requireAuth, loadResto, loadReview, requireAuthorOrAdmin, async (req, res, next) => {
  try {
    await req.review.deleteOne();
    await recomputeInsideRating(req.resto._id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;