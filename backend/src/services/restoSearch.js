const mongoose = require('mongoose');
const Resto = require('../models/Resto');
const Cuisine = require('../models/Cuisine');
const Photo = require('../models/Photo');
const { isOpenAt } = require('../utils/openHours');
const { httpError } = require('../middleware/auth');
const { normalize } = require('./placeMapping');

const OPEN_FILTER_CAP = 1000;
const SORTS = ['for_you', 'distance', 'rating', 'recent', 'name', 'price_asc', 'price_desc'];

/**
 * Score « For You » : goûts de l'utilisateur (cuisines, budget, tags), vérification, note moyenne,
 * et proximité si une position est fournie. Un resto sponsorisé n'est remonté que s'il correspond
 * à au moins un goût : les résultats sponsorisés restent pertinents.
 */
function forYouScore(user, hasGeo) {
  const prefs = (user && user.preferences) || {};
  const cuisines = [...(prefs.cuisines || [])];
  const prices = [...(prefs.price_ranges || [])];
  const tags = [...(prefs.tags || [])];

  const match = {
    $add: [
      { $multiply: [3, { $min: [1, { $size: { $setIntersection: [{ $ifNull: ['$cuisines', []] }, cuisines] } }] }] },
      { $cond: [{ $in: [{ $ifNull: ['$price_range', ''] }, prices] }, 1, 0] },
      { $min: [3, { $size: { $setIntersection: [{ $map: { input: { $ifNull: ['$tags', []] }, in: { $toLower: '$$this' } } }, tags] } }] },
    ],
  };
  return {
    $add: [
      match,
      { $cond: [{ $and: [{ $eq: ['$sponsored', true] }, { $gt: [match, 0] }] }, 1.5, 0] },
      { $cond: [{ $eq: ['$verified', true] }, 1, 0] },
      { $multiply: [{ $ifNull: ['$rating_avg', 0] }, 0.4] },
      hasGeo ? { $multiply: [-0.12, { $min: [{ $divide: [{ $ifNull: ['$distance', 0] }, 1000] }, 25] }] } : 0,
    ],
  };
}

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
async function searchRestos(query, user) {
  const filter = { status: { $ne: 'rejected' } }; // les fiches refusées par la modération n'apparaissent pas

  // Texte libre : chaque mot tapé doit commencer un mot du nom, de la ville, du code postal ou d'un mot-clé
  // (sans accents ni majuscules) ou désigner une cuisine (« italien » trouve les restos de cuisine italienne).
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  if (q) {
    const tokens = normalize(q).split(' ').filter(Boolean).slice(0, 8);
    if (!tokens.length) {
      filter._id = { $in: [] }; // rien d'exploitable dans la saisie (ex. « .* ») : aucun résultat
    } else {
      const cuisines = (await Cuisine.find().select('cuisine_name').lean()).map((c) => ({ id: c._id, name: normalize(c.cuisine_name) }));
      filter.$and = tokens.map((t) => {
        const word = { search_norm: new RegExp(`(^| )${escapeRegex(t)}`) };
        const ids = t.length >= 3 ? cuisines.filter((c) => c.name.startsWith(t)).map((c) => c.id) : [];
        return ids.length ? { $or: [word, { cuisines: { $in: ids } }] } : word;
      });
    }
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
  if (tags.length) filter.tags = { $in: tags.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) };
  for (const [param, field] of [['vegan', 'vegan'], ['halal', 'halal_certificate'], ['verified', 'verified'], ['sponsored', 'sponsored']]) {
    const b = bool(query[param]);
    if (b !== undefined) filter[field] = b;
  }

  // Zone de carte : bbox=ouest,sud,est,nord
  if (query.bbox !== undefined && query.bbox !== '') {
    const b = String(query.bbox).split(',').map(Number);
    const [w, s, e, n] = b;
    if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) throw httpError(400, 'bbox must be west,south,east,north');
    if (!(w < e && s < n) || w < -180 || e > 180 || s < -90 || n > 90) throw httpError(400, 'bbox is out of range');
    if (e - w > 170 || n - s > 170) throw httpError(400, 'bbox is too large');
    filter.geo = { $geoWithin: { $geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } } };
  }
  const mapView = query.view === 'map'; // réponse allégée pour afficher beaucoup de points sur la carte

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

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || (mapView ? 200 : 20), 1), mapView ? 200 : 50);
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
  if (sort === 'for_you') pipeline.push({ $addFields: { for_you_score: forYouScore(user, hasGeo) } });
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
    for_you: { for_you_score: -1 },
  }[sort];
  pipeline.push({ $sort: { ...sortStage, _id: 1 } });

  const view = (r) => {
    const { _hours, price_level, for_you_score, ...resto } = r;
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

  if (mapView) {
    items = items.map((r) => ({
      _id: r._id, name: r.name, geo: r.geo, price_range: r.price_range, rating_avg: r.rating_avg, is_open: r.is_open, sponsored: r.sponsored,
      verified: r.verified, vegan: r.vegan, halal_certificate: r.halal_certificate, cuisines: r.cuisines, distance: r.distance,
      location: r.location && { street: r.location.street, city: r.location.city, zip: r.location.zip },
    }));
  } else {
    await attachPhotos(items);
  }
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

// Joint à chaque resto de la page ses 5 photos les plus récentes (une seule requête pour toute la page)
async function attachPhotos(items) {
  if (!items.length) return;
  const photos = await Photo.find({ resto: { $in: items.map((r) => r._id) } }).sort({ created_at: -1 }).lean();
  const byResto = new Map();
  for (const p of photos) {
    const key = String(p.resto);
    const list = byResto.get(key) || [];
    if (list.length < 5) list.push({ _id: p._id, url: p.url, thumb: p.thumb, caption: p.caption });
    byResto.set(key, list);
  }
  for (const r of items) r.photos = byResto.get(String(r._id)) || [];
}

module.exports = { searchRestos };