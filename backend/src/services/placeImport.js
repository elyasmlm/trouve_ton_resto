const { normalize, fromCategories, socialLinks, cleanWebsites, cleanPhones } = require('./placeMapping');

const DATASET_LABELS = { meta: 'Meta', foursquare: 'Foursquare', alltheplaces: 'AllThePlaces', msft: 'Microsoft', microsoft: 'Microsoft' };
const cleanDataset = (d) => {
  const key = String(d || '').toLowerCase().replace(/\s+/g, '');
  return DATASET_LABELS[key] || d;
};

/**
 * Transforme une ligne extraite d'Overture (voir scripts/import-places.js) en document `Place`.
 * Renvoie null si la ligne est inutilisable (pas de nom, pas de position).
 */
function toPlaceDoc(row, release) {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  // Number(null) vaut 0 : une coordonnée absente deviendrait « 0 » (au large de l'Afrique) au lieu d'être refusée
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const lng = num(row.lng);
  const lat = num(row.lat);
  if (!row.id || !name || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  if (lng === 0 && lat === 0) return null;

  const categories = [row.category, row.kind, ...(row.hierarchy || []), ...(row.alternates || [])].filter(Boolean);
  const mapped = fromCategories(categories);
  const city = (row.city || '').trim();

  return {
    _id: row.id,
    name,
    name_norm: normalize(name),
    brand: row.brand || undefined,
    kind: row.kind || undefined,
    category: row.category || undefined,
    cuisines: mapped.cuisines,
    tags: mapped.tags,
    vegan: mapped.vegan,
    halal: mapped.halal,
    street: (row.street || '').trim() || undefined,
    zip: (row.zip || '').trim() || undefined,
    city: city || undefined,
    city_norm: normalize(city) || undefined,
    region: (row.region || '').trim() || undefined,
    country: (row.country || '').toUpperCase() || undefined,
    geo: { type: 'Point', coordinates: [lng, lat] },
    phones: cleanPhones(row.phones),
    websites: cleanWebsites([...(row.websites || [])]),
    emails: (row.emails || []).filter((e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 100),
    socials: socialLinks([...(row.socials || []), ...(row.websites || [])]),
    confidence: Number.isFinite(num(row.confidence)) ? num(row.confidence) : undefined,
    datasets: [...new Set((row.datasets || []).map(cleanDataset).filter(Boolean))],
    release,
  };
}

module.exports = { toPlaceDoc };