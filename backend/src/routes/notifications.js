const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { requireAuth, httpError } = require('../middleware/auth');
const { pageParams, pageResult } = require('../utils/pagination');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications?unread=1 : les plus récentes d'abord
router.get('/', async (req, res, next) => {
  try {
    const p = pageParams(req.query);
    const filter = { user: req.user._id };
    if (req.query.unread === '1') filter.read = false;
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ created_at: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ ...pageResult(items, total, p), unread });
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const { modifiedCount } = await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ updated: modifiedCount });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Notification not found');
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { read: true } }, { new: true });
    if (!notification) throw httpError(404, 'Notification not found');
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Notification not found');
    const { deletedCount } = await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    if (!deletedCount) throw httpError(404, 'Notification not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
