const express = require('express');
const Resto = require('../models/Resto');
const Cuisine = require('../models/Cuisine');
const { normalize, escapeRegex } = require('../services/placeMapping');

const router = express.Router();

// GET /api/suggest?q=piz : propositions pendant la frappe (restos, cuisines, mots-clés)
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const tokens = normalize(q).split(' ').filter(Boolean).slice(0, 6);
    res.set('Cache-Control', 'public, max-age=30');
    if (!tokens.length || normalize(q).length < 2) return res.json({ restos: [], cuisines: [], tags: [] });
    const last = tokens[tokens.length - 1];

    const [restos, cuisines, tags] = await Promise.all([
      Resto.find({ status: { $ne: 'rejected' }, $and: tokens.map((t) => ({ search_norm: new RegExp(`(^| )${escapeRegex(t)}`) })) })
        .sort({ verified: -1, sponsored: -1, name: 1 })
        .limit(5)
        .select('name location.city')
        .lean(),
      Cuisine.find().select('cuisine_name').lean(),
      Resto.aggregate([
        { $match: { status: { $ne: 'rejected' } } },
        { $unwind: '$tags' },
        { $project: { tag: { $toLower: '$tags' } } },
        { $match: { tag: new RegExp(`^${escapeRegex(last)}`, 'i') } },
        { $group: { _id: '$tag', n: { $sum: 1 } } },
        { $sort: { n: -1, _id: 1 } },
        { $limit: 4 },
      ]),
    ]);

    res.json({
      restos: restos.map((r) => ({ _id: r._id, name: r.name, city: r.location && r.location.city })),
      cuisines: last.length >= 2 ? cuisines.filter((c) => normalize(c.cuisine_name).startsWith(last)).slice(0, 3).map((c) => ({ _id: c._id, name: c.cuisine_name })) : [],
      tags: tags.map((t) => t._id),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;