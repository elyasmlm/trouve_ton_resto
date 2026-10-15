const express = require('express');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const Resto = require('../models/Resto');
const Photo = require('../models/Photo');
const Review = require('../models/Review');
const { requireAuth, httpError } = require('../middleware/auth');

const router = express.Router();

const MAX_REPORTS_PER_DAY = 20;

// Retrouve le resto concerné par un contenu signalé (404 si le contenu n'existe pas)
async function restoOf(type, target) {
  if (type === 'resto') return (await Resto.exists({ _id: target })) ? target : null;
  const doc = type === 'photo' ? await Photo.findById(target).select('resto').lean() : await Review.findById(target).select('resto').lean();
  return doc ? doc.resto : null;
}

// POST /api/reports { type: 'resto' | 'photo' | 'review', target, reason, details? }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, target, reason, details } = req.body || {};
    if (!Report.TYPES.includes(type)) throw httpError(400, `type must be one of ${Report.TYPES.join(', ')}`);
    if (!Report.REASONS.includes(reason)) throw httpError(400, `reason must be one of ${Report.REASONS.join(', ')}`);
    if (!mongoose.isValidObjectId(target)) throw httpError(400, 'target must be a valid id');
    if (details !== undefined && (typeof details !== 'string' || details.length > 500)) throw httpError(400, 'details must be at most 500 characters');

    const resto = await restoOf(type, target);
    if (!resto) throw httpError(404, 'Content not found');

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    if ((await Report.countDocuments({ reporter: req.user._id, created_at: { $gte: since } })) >= MAX_REPORTS_PER_DAY) {
      throw httpError(429, `You can send up to ${MAX_REPORTS_PER_DAY} reports per day`);
    }

    const report = await Report.create({ reporter: req.user._id, type, target, resto, reason, details });
    res.status(201).json({ report: { _id: report._id, type, target, reason } });
  } catch (err) {
    if (err.code === 11000) return next(httpError(409, 'You already reported this'));
    next(err);
  }
});

module.exports = router;