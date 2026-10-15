const Place = require('../models/Place');
const { httpError } = require('../middleware/auth');
const { normalize, escapeRegex, fromOsmTags } = require('./placeMapping');

// Recherche de lieux pour préremplir le formulaire d'ajout. Deux sources, interrogées en même temps :
//  1. notre base locale (Overture Maps / Foursquare / Meta, importée par scripts/import-places.js) : très complète en contacts ;
//  2. OpenStreetMap (Nominatim) : horaires, régimes, accessibilité, et ce qui manque à la base locale.
// Un même lieu trouvé dans les deux est fusionné en une seule proposition, aux informations complétées.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
// politique d'usage de Nominatim : 1 requête par seconde (réglable uniquement pour les tests)
const minInterval = () => (process.env.NOMINATIM_MIN_INTERVAL_MS !== undefined ? Number(process.env.NOMINATIM_MIN_INTERVAL_MS) : 1100);
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 500;
const LOCAL_RADIUS_M = 30000;
const MAX_RESULTS = 8;
const FOOD_TYPES = new Set(['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'ice_cream', 'bakery', 'wine_bar', 'tea_room']);

const cache = new Map();
let chain = Promise.resolve();
let lastCall = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// file d'attente : jamais deux appels à Nominatim à moins de 1,1 s d'intervalle, quel que soit le nombre d'utilisateurs
function schedule(task) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + minInterval() - Date.now());
    if (wait) await sleep(wait);
    lastCall = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}

const first = (list) => (Array.isArray(list) && list.length ? list[0] : '');

// forme commune aux deux sources, celle que reçoit le frontend
function build(p) {
  const phones = p.phones || [];
  const websites = p.websites || [];
  return {
    id: p.id,
    name: p.name,
    street: p.street || '',
    zip: p.zip || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    lat: p.lat,
    lng: p.lng,
    phone: first(phones),
    phones,
    website: first(websites),
    websites,
    email: first(p.emails),
    socials: p.socials || {},
    cuisines: p.cuisines || [],
    tags: p.tags || [],
    vegan: Boolean(p.vegan),
    halal: Boolean(p.halal),
    hours: p.hours || null,
    kind: p.kind || '',
    sources: p.sources || [],
    confidence: p.confidence ?? null,
    display_name: p.display_name || [p.name, p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    _food: p._food,
  };
}

function shapeOsm(r) {
  const a = r.address || {};
  const country = (a.country_code || '').toUpperCase();
  const extra = fromOsmTags(r.extratags, country);
  return build({
    id: `osm:${r.osm_type}${r.osm_id}`,
    name: r.name || String(r.display_name || '').split(',')[0],
    street: [a.house_number, a.road || a.pedestrian || a.footway || a.square].filter(Boolean).join(' '),
    zip: a.postcode,
    city: a.city || a.town || a.village || a.municipality || a.suburb,
    state: a.state || a.region || a.county,
    country,
    lat: Number(r.lat),
    lng: Number(r.lon),
    ...extra,
    kind: r.type,
    sources: ['OpenStreetMap'],
    display_name: r.display_name,
    _food: r.category === 'amenity' && FOOD_TYPES.has(r.type),
  });
}

function shapeLocal(doc) {
  return build({
    id: `local:${doc._id}`,
    name: doc.name,
    street: doc.street,
    zip: doc.zip,
    city: doc.city,
    state: doc.region,
    country: doc.country,
    lat: doc.geo.coordinates[1],
    lng: doc.geo.coordinates[0],
    phones: doc.phones,
    websites: doc.websites,
    emails: doc.emails,
    socials: doc.socials,
    cuisines: doc.cuisines,
    tags: doc.tags,
    vegan: doc.vegan,
    halal: doc.halal,
    kind: doc.category || doc.kind,
    sources: doc.datasets,
    confidence: doc.confidence,
  });
}

// ---------- recherche dans la base locale ----------
async function searchLocal({ name, city, lat, lng }) {
  const tokens = normalize(name).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const cityNorm = normalize(city);
  const hasPosition = Number.isFinite(lat) && Number.isFinite(lng);
  // chaque mot tapé doit commencer un mot du nom (le dernier peut être incomplet : recherche « au fil de la frappe »)
  const filter = { $and: tokens.map((t) => ({ name_norm: new RegExp(`(^| )${escapeRegex(t)}`) })) };

  if (cityNorm) {
    filter.city_norm = new RegExp(`^${escapeRegex(cityNorm)}`);
    return Place.find(filter).sort({ confidence: -1 }).limit(MAX_RESULTS).lean();
  }
  if (hasPosition) {
    return Place.aggregate([{ $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distance', maxDistance: LOCAL_RADIUS_M, spherical: true, query: filter } }, { $limit: MAX_RESULTS }]);
  }
  return Place.find({ $text: { $search: tokens.map((t) => `"${t}"`).join(' ') } }, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, confidence: -1 })
    .limit(MAX_RESULTS)
    .lean();
}

// ---------- recherche OpenStreetMap ----------
async function searchOsm({ name, city, lat, lng }) {
  const q = [name, city].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', extratags: '1', limit: '8', dedupe: '1', 'accept-language': 'fr' });
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    // « de préférence autour de moi » (sans exclure le reste)
    params.set('viewbox', [lng - 0.4, lat + 0.3, lng + 0.4, lat - 0.3].map((n) => n.toFixed(3)).join(','));
    params.set('bounded', '0');
  }
  const key = params.toString().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

  const results = await schedule(async () => {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'TrouveTonResto/1.0 (projet en developpement)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
    return res.json();
  });

  const shaped = (Array.isArray(results) ? results : []).map(shapeOsm).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  // on ne garde que les lieux où l'on mange ou boit ; s'il n'y en a aucun, on laisse les adresses
  const food = shaped.filter((p) => p._food);
  const items = (food.length ? food : shaped).map(({ _food, ...p }) => p);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), items });
  return items;
}

// ---------- fusion ----------
function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const STOP = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'et', 'chez', 'au', 'aux', 'restaurant', 'cafe', 'bar', 'brasserie']);
const words = (name) => new Set(normalize(name).split(' ').filter((w) => w && !STOP.has(w)));

function sameVenue(a, b) {
  if (distanceMeters(a, b) > 150) return false;
  const wa = words(a.name);
  const wb = words(b.name);
  if (!wa.size || !wb.size) return normalize(a.name) === normalize(b.name);
  const common = [...wa].filter((w) => wb.has(w)).length;
  return common / new Set([...wa, ...wb]).size >= 0.5 || common === Math.min(wa.size, wb.size);
}

const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

function mergeInto(base, extra) {
  const fill = (key) => base[key] || extra[key];
  Object.assign(base, {
    street: fill('street'), zip: fill('zip'), city: fill('city'), state: fill('state'), country: fill('country'),
    phones: union(base.phones, extra.phones), websites: union(base.websites, extra.websites),
    cuisines: union(base.cuisines, extra.cuisines), tags: union(base.tags, extra.tags), sources: union(base.sources, extra.sources),
    socials: { ...extra.socials, ...base.socials },
    vegan: base.vegan || extra.vegan, halal: base.halal || extra.halal,
    hours: base.hours || extra.hours, confidence: base.confidence ?? extra.confidence,
  });
  base.phone = base.phones[0] || '';
  base.website = base.websites[0] || '';
  base.email = base.email || extra.email;
  return base;
}

function mergePlaces(places) {
  const out = [];
  for (const p of places) {
    const twin = out.find((e) => sameVenue(e, p));
    if (twin) mergeInto(twin, p);
    else out.push({ ...p });
  }
  return out;
}

async function searchPlaces(input) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  const city = String(input.city || '').trim().replace(/\s+/g, ' ');
  const lat = Number.isFinite(input.lat) ? input.lat : undefined;
  const lng = Number.isFinite(input.lng) ? input.lng : undefined;
  if (name.length < 2 || name.length > 100 || city.length > 100) throw httpError(400, 'name must be 2 to 100 characters');
  if (!city && lat === undefined && name.length < 4) throw httpError(400, 'Give a city, or a longer name');

  const [local, osm] = await Promise.allSettled([searchLocal({ name, city, lat, lng }), searchOsm({ name, city, lat, lng })]);
  const localItems = local.status === 'fulfilled' ? local.value.map(shapeLocal) : [];
  if (osm.status === 'rejected' && !localItems.length) throw httpError(502, 'Place search is unavailable right now');
  const osmItems = osm.status === 'fulfilled' ? osm.value : [];

  // OpenStreetMap d'abord : ses téléphones et sites, saisis par des contributeurs, sont souvent les plus à jour
  const merged = mergePlaces([...osmItems, ...localItems]);
  const hasPosition = lat !== undefined && lng !== undefined;
  merged.sort(
    (a, b) =>
      b.sources.length - a.sources.length ||
      (hasPosition ? distanceMeters({ lat, lng }, a) - distanceMeters({ lat, lng }, b) : 0) ||
      (b.confidence ?? 0) - (a.confidence ?? 0)
  );
  return merged.slice(0, MAX_RESULTS).map(({ _food, ...p }) => p);
}

const clearPlacesCache = () => cache.clear();

module.exports = { searchPlaces, clearPlacesCache, mergePlaces };
