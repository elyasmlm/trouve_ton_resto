const express = require('express');
const mongoose = require('mongoose');
const Resto = require('../models/Resto');
const Photo = require('../models/Photo');
const Review = require('../models/Review');
const Report = require('../models/Report');
const { requireAuth, requireRole, httpError } = require('../middleware/auth');
const { removeImageFiles } = require('../services/images');
const { recomputeInsideRating } = require('../services/ratings');
const { pageParams, pageResult } = require('../utils/pagination');

// Espace de modération : réservé aux admins
const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const PENDING = { verified: false, status: { $ne: 'rejected' } };
const validId = (id) => mongoose.isValidObjectId(id);

router.get('/stats', async (req, res, next) => {
  try {
    const [pending, reports] = await Promise.all([
      Resto.countDocuments(PENDING),
      Report.aggregate([{ $match: { status: 'open' } }, { $group: { _id: { type: '$type', target: '$target' } } }, { $count: 'n' }]),
    ]);
    res.json({ pending, reports: reports[0] ? reports[0].n : 0 });
  } catch (err) {
    next(err);
  }
});

// ---------- fiches de restos ----------
// GET /api/admin/restos?filter=pending|rejected : la plus ancienne d'abord (file d'attente)
router.get('/restos', async (req, res, next) => {
  try {
    const filter = req.query.filter === 'rejected' ? { status: 'rejected' } : PENDING;
    const p = pageParams(req.query);
    const [restos, total] = await Promise.all([
      Resto.find(filter).sort({ created_at: 1, _id: 1 }).skip(p.skip).limit(p.limit).populate('added_by', 'username').populate('cuisines', 'cuisine_name').lean(),
      Resto.countDocuments(filter),
    ]);
    const photos = await Photo.find({ resto: { $in: restos.map((r) => r._id) } }).sort({ created_at: -1 }).select('url thumb resto').lean();
    for (const r of restos) r.photos = photos.filter((ph) => String(ph.resto) === String(r._id)).slice(0, 6);
    res.json(pageResult(restos, total, p));
  } catch (err) {
    next(err);
  }
});

async function moderate(req, res, next, update) {
  try {
    if (!validId(req.params.id)) throw httpError(404, 'Resto not found');
    const resto = await Resto.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!resto) throw httpError(404, 'Resto not found');
    res.json({ resto });
  } catch (err) {
    next(err);
  }
}

router.post('/restos/:id/verify', (req, res, next) =>
  moderate(req, res, next, { $set: { verified: true, status: 'active' }, $unset: { rejection_reason: '' } })
);

router.post('/restos/:id/reject', (req, res, next) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 300) return next(httpError(400, 'reason must be 3 to 300 characters'));
  return moderate(req, res, next, { $set: { verified: false, status: 'rejected', rejection_reason: reason } });
});

// remet une fiche refusée dans la file « à vérifier »
router.post('/restos/:id/restore', (req, res, next) => moderate(req, res, next, { $set: { verified: false, status: 'active' }, $unset: { rejection_reason: '' } }));

// ---------- signalements ----------
// GET /api/admin/reports : un élément par contenu signalé, avec le nombre de signalements et leurs motifs
router.get('/reports', async (req, res, next) => {
  try {
    const groups = await Report.aggregate([
      { $match: { status: 'open' } },
      { $sort: { created_at: 1 } },
      {
        $group: {
          _id: { type: '$type', target: '$target' },
          id: { $first: '$_id' }, // sert à traiter tout le groupe (voir /resolve)
          resto: { $first: '$resto' },
          count: { $sum: 1 },
          reasons: { $addToSet: '$reason' },
          details: { $push: '$details' },
          reporters: { $push: '$reporter' },
          first_at: { $first: '$created_at' },
        },
      },
      { $sort: { count: -1, first_at: 1 } },
      { $limit: 100 },
    ]);

    const ids = (type) => groups.filter((g) => g._id.type === type).map((g) => g._id.target);
    const [restos, photos, reviews, users] = await Promise.all([
      Resto.find({ _id: { $in: [...ids('resto'), ...groups.map((g) => g.resto)] } }).select('name location.city status verified').lean(),
      Photo.find({ _id: { $in: ids('photo') } }).select('url thumb caption user').lean(),
      Review.find({ _id: { $in: ids('review') } }).select('rating comment user').lean(),
      mongoose.model('User').find({ _id: { $in: groups.flatMap((g) => g.reporters) } }).select('username').lean(),
    ]);
    const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
    const [R, P, V, U] = [byId(restos), byId(photos), byId(reviews), byId(users)];

    res.json({
      items: groups.map((g) => {
        const type = g._id.type;
        const content = type === 'resto' ? R.get(String(g._id.target)) : type === 'photo' ? P.get(String(g._id.target)) : V.get(String(g._id.target));
        return {
          id: g.id,
          type,
          target: g._id.target,
          resto: R.get(String(g.resto)) || null,
          content: content || null, // null : déjà supprimé
          count: g.count,
          reasons: g.reasons,
          details: g.details.filter(Boolean).slice(0, 5),
          reporters: g.reporters.slice(0, 5).map((id) => (U.get(String(id)) || {}).username).filter(Boolean),
          created_at: g.first_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reports/:id/resolve { action: 'remove' | 'dismiss' } : traite tous les signalements ouverts du même contenu
router.post('/reports/:id/resolve', async (req, res, next) => {
  try {
    const action = req.body?.action;
    if (!['remove', 'dismiss'].includes(action)) throw httpError(400, 'action must be remove or dismiss');
    if (!validId(req.params.id)) throw httpError(404, 'Report not found');
    const report = await Report.findOne({ _id: req.params.id, status: 'open' });
    if (!report) throw httpError(404, 'Report not found');

    if (action === 'remove') {
      if (report.type === 'photo') {
        const photo = await Photo.findByIdAndDelete(report.target);
        if (photo) await removeImageFiles(photo).catch(() => {});
      } else if (report.type === 'review') {
        if (await Review.findByIdAndDelete(report.target)) await recomputeInsideRating(report.resto);
      } else {
        await Resto.updateOne({ _id: report.target }, { $set: { verified: false, status: 'rejected', rejection_reason: `Signalement : ${report.reason}` } });
      }
    }

    const { modifiedCount } = await Report.updateMany(
      { type: report.type, target: report.target, status: 'open' },
      { $set: { status: 'resolved', resolution: action === 'remove' ? 'removed' : 'dismissed', resolved_by: req.user._id, resolved_at: new Date() } }
    );
    res.json({ resolved: modifiedCount, action });
  } catch (err) {
    next(err);
  }
});

module.exports = router;