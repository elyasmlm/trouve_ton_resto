const express = require('express');
const Resto = require('../models/Resto');

const router = express.Router();

// Mots-clés tendance (v1) : tags et cuisines les plus présents dans le catalogue.
// Un vrai classement par recherches / vues viendra avec les statistiques.
router.get('/', async (req, res, next) => {
  try {
    const [tags, cuisines] = await Promise.all([
      Resto.aggregate([
        { $match: { status: { $ne: 'rejected' } } },
        { $unwind: '$tags' },
        { $group: { _id: { $toLower: '$tags' }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
      ]),
      Resto.aggregate([
        { $match: { status: { $ne: 'rejected' } } },
        { $unwind: '$cuisines' },
        { $group: { _id: '$cuisines', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 },
        { $lookup: { from: 'cuisines', localField: '_id', foreignField: '_id', as: 'c' } },
        { $project: { count: 1, name: { $first: '$c.cuisine_name' } } },
      ]),
    ]);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      tags: tags.map((t) => ({ tag: t._id, count: t.count })),
      cuisines: cuisines.filter((c) => c.name).map((c) => ({ _id: c._id, name: c.name, count: c.count })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;