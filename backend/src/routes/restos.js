const express = require('express');
const mongoose = require('mongoose');
const Resto = require('../models/Resto');
const OpenHours = require('../models/OpenHours');
const Rating = require('../models/Rating');
const Review = require('../models/Review');
const Photo = require('../models/Photo');
const { removeImageFiles } = require('../services/images');
const { requireAuth, requireRole, httpError } = require('../middleware/auth');
const { searchRestos } = require('../services/restoSearch');
const loadResto = require('../middleware/loadResto');
const reviewRoutes = require('./reviews');
const photoRoutes = require('./photos');
const ratingRoutes = require('./ratings');
const { isOpenAt } = require('../utils/openHours');

const router = express.Router();

const EDITABLE = [
  'name', 'price_range', 'cuisines', 'meal_types', 'halal_certificate', 'vegan',
  'social_networks', 'phone_numbers', 'website', 'tags',
];
const ADMIN_ONLY = ['verified', 'sponsored', 'sponsored_until', 'status'];
const LOCATION_FIELDS = ['street', 'city', 'state', 'zip', 'country'];

function toGeo(input) {
  if (input === null) return null;
  const coordinates = Array.isArray(input.coordinates) ? input.coordinates : [input.lng, input.lat];
  return { type: 'Point', coordinates: coordinates.map(Number) };
}

// Règle de l'appli : chaque resto est halal, ou à défaut propose au moins une option végétarienne.
// (`vegan` = « options végé / vegan », `halal_certificate` = « halal ».)
const DIET_RULE = 'A resto must be halal or offer a vegetarian option';
function checkDiet(resto) {
  if (!resto.halal_certificate && !resto.vegan) throw httpError(400, DIET_RULE);
}
// modifier la fiche (hors champs de modération réservés aux admins) oblige à respecter la règle
const touchesContent = (body) => EDITABLE.some((key) => body[key] !== undefined) || body.location !== undefined || body.geo !== undefined;

function applyBody(resto, body, isAdmin) {
  for (const key of isAdmin ? [...EDITABLE, ...ADMIN_ONLY] : EDITABLE) {
    if (body[key] !== undefined) resto.set(key, body[key]);
  }
  if (body.location && typeof body.location === 'object') {
    for (const key of LOCATION_FIELDS) {
      if (body.location[key] !== undefined) resto.set(`location.${key}`, body.location[key]);
    }
  }
  if (body.geo !== undefined) {
    resto.set('geo', body.geo === null ? undefined : toGeo(body.geo));
  }
}

function canEdit(user, resto) {
  if (user.role === 'admin') return true;
  if ((user.restos || []).some((id) => id.equals(resto._id))) return true;
  // l'auteur peut corriger sa fiche tant qu'elle n'a pas été vérifiée
  return !resto.verified && resto.added_by && resto.added_by.equals(user._id);
}

function requireEditor(req, res, next) {
  if (!canEdit(req.user, req.resto)) return next(httpError(403, 'Forbidden'));
  next();
}

router.use('/:id/reviews', reviewRoutes);
router.use('/:id/photos', photoRoutes);
router.use('/:id/ratings', ratingRoutes);

router.get('/', async (req, res, next) => {
  try {
    res.json(await searchRestos(req.query, req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', loadResto, async (req, res, next) => {
  try {
    const [resto, hours, ratings] = await Promise.all([
      Resto.findById(req.resto._id).populate('cuisines').lean(),
      OpenHours.findOne({ resto: req.resto._id }).lean(),
      Rating.find({ resto: req.resto._id }).lean(),
    ]);
    res.json({ resto: { ...resto, open_hours: hours || null, ratings, is_open: isOpenAt(hours) } });
  } catch (err) {
    next(err);
  }
});

// Un utilisateur ne peut pas ajouter plus de 10 restos par jour (les admins n'ont pas de limite)
const MAX_NEW_RESTOS_PER_DAY = 10;

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      if ((await Resto.countDocuments({ added_by: req.user._id, created_at: { $gte: since } })) >= MAX_NEW_RESTOS_PER_DAY) {
        throw httpError(429, `You can add up to ${MAX_NEW_RESTOS_PER_DAY} restos per day`);
      }
    }
    const resto = new Resto({ added_by: req.user._id });
    applyBody(resto, req.body || {}, req.user.role === 'admin');
    checkDiet(resto);
    await resto.save();
    res.status(201).json({ resto });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, loadResto, requireEditor, async (req, res, next) => {
  try {
    applyBody(req.resto, req.body || {}, req.user.role === 'admin');
    if (touchesContent(req.body || {})) checkDiet(req.resto);
    await req.resto.save();
    res.json({ resto: req.resto });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/open-hours', requireAuth, loadResto, requireEditor, async (req, res, next) => {
  try {
    const { timezone, weekly, exceptions, temporaryClosures } = req.body || {};
    const hours = (await OpenHours.findOne({ resto: req.resto._id })) || new OpenHours({ resto: req.resto._id });
    hours.set({ timezone, weekly, exceptions, temporaryClosures });
    await hours.save();
    if (!req.resto.open_hours) {
      req.resto.open_hours = hours._id;
      await req.resto.save();
    }
    res.json({ open_hours: hours });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), loadResto, async (req, res, next) => {
  try {
    const id = req.resto._id;
    const db = mongoose.connection;
    await Promise.all([
      OpenHours.deleteMany({ resto: id }),
      Rating.deleteMany({ resto: id }),
      Review.deleteMany({ resto: id }),
      Photo.find({ resto: id }).lean().then((photos) => Promise.all(photos.map((p) => removeImageFiles(p).catch(() => {})))).then(() => Photo.deleteMany({ resto: id })),
      db.collection('lists').updateMany({ restos: id }, { $pull: { restos: id } }),
    ]);
    await req.resto.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;