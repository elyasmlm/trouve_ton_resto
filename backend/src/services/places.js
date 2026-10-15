const { httpError } = require('../middleware/auth');

// Recherche de lieux via OpenStreetMap (Nominatim), sans clé. Politique d'usage : 1 requête/s maximum,
// un User-Agent qui nous identifie, et du cache. Les résultats servent à préremplir le formulaire d'ajout.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 500;

const cache = new Map();
let chain = Promise.resolve();
let lastCall = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// file d'attente : jamais deux appels à moins de 1,1 s d'intervalle, quel que soit le nombre d'utilisateurs
function schedule(task) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
    if (wait) await sleep(wait);
    lastCall = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}

function shape(r) {
  const a = r.address || {};
  const street = [a.house_number, a.road || a.pedestrian || a.footway || a.square].filter(Boolean).join(' ');
  return {
    id: `${r.osm_type}${r.osm_id}`,
    name: r.name || String(r.display_name || '').split(',')[0],
    category: r.category,
    type: r.type,
    street,
    zip: a.postcode || '',
    city: a.city || a.town || a.village || a.municipality || a.suburb || '',
    state: a.state || a.region || a.county || '',
    country: (a.country_code || '').toUpperCase(),
    lat: Number(r.lat),
    lng: Number(r.lon),
    display_name: r.display_name,
  };
}

async function searchPlaces(query) {
  const q = String(query || '').trim().replace(/\s+/g, ' ');
  if (q.length < 3 || q.length > 100) throw httpError(400, 'q must be 3 to 100 characters');
  const key = q.toLowerCase();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '6', dedupe: '1', 'accept-language': 'fr' });
  let results;
  try {
    results = await schedule(async () => {
      const res = await fetch(`${ENDPOINT}?${params}`, {
        headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'TrouveTonResto/1.0 (projet en developpement)', Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
      return res.json();
    });
  } catch {
    throw httpError(502, 'Place search is unavailable right now');
  }

  const items = (Array.isArray(results) ? results : []).map(shape).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), items });
  return items;
}

const clearPlacesCache = () => cache.clear();

module.exports = { searchPlaces, clearPlacesCache };