const express = require('express');
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const loadResto = require('../middleware/loadResto');
const { requireAuth, httpError } = require('../middleware/auth');
const { pageParams, pageResult } = require('../utils/pagination');

const router = express.Router({ mergeParams: true });

router.get('/', loadResto, async (req, res, next) => {
  try {
    const p = pageParams(req.query);
    const filter = { resto: req.resto._id };
    const [items, total] = await Promise.all([
      Photo.find(filter).sort({ created_at: -1, _id: 1 }).skip(p.skip).limit(p.limit).populate('user', 'username').lean(),
      Photo.countDocuments(filter),
    ]);
    res.json(pageResult(items, total, p));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, loadResto, async (req, res, next) => {
  try {
    const { url, caption } = req.body || {};
    const photo = await Photo.create({ resto: req.resto._id, user: req.user._id, url, caption });
    res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
});

// L'auteur, le propriétaire du resto ou un admin peuvent supprimer
router.delete('/:photoId', requireAuth, loadResto, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.photoId)) throw httpError(404, 'Photo not found');
    const photo = await Photo.findOne({ _id: req.params.photoId, resto: req.resto._id });
    if (!photo) throw httpError(404, 'Photo not found');
    const owner = (req.user.restos || []).some((id) => id.equals(req.resto._id));
    if (req.user.role !== 'admin' && !owner && !photo.user.equals(req.user._id)) throw httpError(403, 'Forbidden');
    await photo.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;