const mongoose = require('mongoose');
const Resto = require('../models/Resto');
const Cuisine = require('../models/Cuisine');
const { isOpenAt } = require('../utils/openHours');
const { httpError } = require('../middleware/auth');

const OPEN_FILTER_CAP = 1000;
const SORTS = ['distance', 'rating', 'recent', 'name', 'price_asc', 'price_desc'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const list = (v) =>
  v === undefined || v === '' ? [] : [].concat(v).join(',').split(',').map((s) => s.trim()).filter(Boolean);
const bool = (v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined);

function num(v, name, min, max) {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${name} is invalid`);
  return n;
}

// "2" -> "€€", "€€" -> "€€"
const normalizePrice = (p) => (/^[1-4]$/.test(p) ? '€'.repeat(Number(p)) : p);

async function resolveCuisines(values) {
  const ids = [];
  const names = [];
  values.forEach((v) => (mongoose.isValidObjectId(v) ? ids.push(new mongoose.Types.ObjectId(v)) : names.push(v)));
  if (names.length) {
    const found = await Cuisine.find({
      $or: names.map((n) => ({ cuisine_name: new RegExp(`^${escapeRegex(n)}$`, 'i') })),
    }).lean();
    ids.push(...found.map((c) => c._id));
  }
  return ids;
}

/**
 * Paramètres : q, city, country, cuisine (noms ou ids, séparés par des virgules), price (1-4 ou €…),
 * meal, tags, vegan, halal, verified, sponsored, minRating (0-5),
 * lat + lng (+ radius en km) pour la proximité, open (now | date ISO), sort, page, limit.
 */
async function searchRestos(query) {
  const filter = {};

  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { tags: rx }, { 'location.city': rx }];
  }
  if (query.city) filter['location.city'] = new RegExp(`^${escapeRegex(String(query.city).trim())}$`, 'i');
  if (query.country) filter['location.country'] = String(query.country).trim().toUpperCase();

  const cuisineValues = list(query.cuisine);
  if (cuisineValues.length) {
    const ids = await resolveCuisines(cuisineValues);
    filter.cuisines = { $in: ids }; // aucun id trouvé => aucun résultat
  }
  const prices = list(query.price).map(normalizePrice);
  if (prices.length) filter.price_range = { $in: prices };
  const meals = list(query.meal);
  if (meals.length) filter.meal_types = { $in: meals };
  const tags = list(query.tags);
  if (tags.length) filter.tags = { $in: tags };
  for (const [param, field] of [['vegan', 'vegan'], ['halal', 'halal_certificate'], ['verified', 'verified'], ['sponsored', 'sponsored']]) {
    const b = bool(query[param]);
    if (b !== undefined) filter[field] = b;
  }

  const minRating = num(query.minRating, 'minRating', 0, 5);
  const lat = num(query.lat, 'lat', -90, 90);
  const lng = num(query.lng, 'lng', -180, 180);
  const radius = num(query.radius, 'radius', 0, 20000);
  if ((lat === undefined) !== (lng === undefined)) throw httpError(400, 'lat and lng must be given together');
  const hasGeo = lat !== undefined;

  let openAt;
  if (query.open !== undefined && query.open !== '') {
    openAt = query.open === 'now' ? new Date() : new Date(query.open);
    if (Number.isNaN(openAt.getTime())) throw httpError(400, 'open must be "now" or an ISO date');
  }

  const sort = query.sort || (hasGeo ? 'distance' : 'recent');
  if (!SORTS.includes(sort)) throw httpError(400, `sort must be one of ${SORTS.join(', ')}`);
  if (sort === 'distance' && !hasGeo) throw httpError(400, 'sort=distance requires lat and lng');

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  const pipeline = [];
  if (hasGeo) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distance',
        spherical: true,
        query: filter,
        ...(radius !== undefined && { maxDistance: radius * 1000 }),
      },
    });
  } else {
    pipeline.push({ $match: filter });
  }
  pipeline.push({
    $addFields: {
      rating_avg: { $avg: ['$rating.google_rating', '$rating.tripadvisor_rating', '$rating.inside_rating'] },
      price_level: { $strLenCP: { $ifNull: ['$price_range', ''] } },
    },
  });
  if (minRating !== undefined) pipeline.push({ $match: { rating_avg: { $gte: minRating } } });
  pipeline.push(
    { $lookup: { from: 'open_hours', localField: '_id', foreignField: 'resto', as: '_hours' } },
    { $addFields: { _hours: { $first: '$_hours' } } }
  );

  const sortStage = {
    distance: { distance: 1 },
    rating: { rating_avg: -1 },
    recent: { created_at: -1 },
    name: { name: 1 },
    price_asc: { price_level: 1 },
    price_desc: { price_level: -1 },
  }[sort];
  pipeline.push({ $sort: { ...sortStage, _id: 1 } });

  const view = (r) => {
    const { _hours, price_level, ...resto } = r;
    resto.is_open = isOpenAt(_hours, openAt || new Date());
    if (resto.rating_avg != null) resto.rating_avg = Math.round(resto.rating_avg * 10) / 10;
    return resto;
  };

  let items;
  let total;
  if (openAt) {
    // L'état ouvert/fermé dépend du fuseau de chaque resto : on le calcule côté serveur, puis on pagine.
    const all = (await Resto.aggregate([...pipeline, { $limit: OPEN_FILTER_CAP }])).map(view).filter((r) => r.is_open === true);
    total = all.length;
    items = all.slice((page - 1) * limit, page * limit);
  } else {
    const [res] = await Resto.aggregate([
      ...pipeline,
      { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]);
    items = res.items.map(view);
    total = res.total[0] ? res.total[0].n : 0;
  }

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

module.exports = { searchRestos };