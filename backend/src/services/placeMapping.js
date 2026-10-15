// Traduction des données de lieux externes (Overture / Foursquare, OpenStreetMap) vers le vocabulaire de l'appli :
// cuisines, mots-clés, horaires, réseaux sociaux. Fonctions pures, sans accès réseau ni base de données.

const COUNTRY_TZ = {
  FR: 'Europe/Paris', BE: 'Europe/Brussels', LU: 'Europe/Luxembourg', CH: 'Europe/Zurich', ES: 'Europe/Madrid', IT: 'Europe/Rome',
  PT: 'Europe/Lisbon', DE: 'Europe/Berlin', GB: 'Europe/London', MA: 'Africa/Casablanca', DZ: 'Africa/Algiers', TN: 'Africa/Tunis',
};
const timezoneFor = (country) => COUNTRY_TZ[String(country || '').toUpperCase()] || null;

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// « Café de l'Été » -> « cafe de l ete » : sert à comparer et à chercher sans tenir compte des accents ni de la casse
const normalize = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- cuisines et mots-clés ----------
// mots-clés (catégories Overture ou valeurs « cuisine » d'OpenStreetMap) -> cuisines de la collection `cuisines`
const CUISINE_WORDS = {
  Française: ['french', 'brasserie', 'bistro', 'bistrot'],
  Italienne: ['italian', 'pizza', 'pizzeria', 'pasta'],
  Japonaise: ['japanese', 'sushi', 'ramen', 'izakaya', 'yakitori', 'tempura', 'teppanyaki', 'udon'],
  Libanaise: ['lebanese'],
  Orientale: ['middle eastern', 'oriental', 'arab', 'syrian'],
  Indienne: ['indian'],
  Burger: ['burger', 'hamburger'],
  Végétarienne: ['vegetarian', 'vegan'],
  Chinoise: ['chinese', 'dim sum', 'cantonese', 'szechuan', 'hot pot'],
  Thaïlandaise: ['thai'],
  Vietnamienne: ['vietnamese', 'pho'],
  Coréenne: ['korean'],
  Mexicaine: ['mexican', 'texmex', 'tex mex', 'taco', 'tacos'],
  Marocaine: ['moroccan', 'couscous', 'north african', 'maghreb'],
  Turque: ['turkish', 'kebab', 'doner'],
  Grecque: ['greek'],
  Espagnole: ['spanish', 'tapas'],
  Africaine: ['african', 'senegalese', 'ethiopian'],
  Américaine: ['american', 'steak', 'steakhouse', 'steak house', 'bbq', 'barbecue'],
  'Fruits de mer': ['seafood', 'fish', 'oyster'],
  Crêperie: ['creperie', 'crepe', 'crepes'],
  Méditerranéenne: ['mediterranean'],
};

const TAG_WORDS = {
  pizza: ['pizza', 'pizzeria'],
  sushi: ['sushi'],
  ramen: ['ramen'],
  kebab: ['kebab', 'doner'],
  tapas: ['tapas'],
  grillades: ['steak', 'steakhouse', 'steak house', 'grill'],
  barbecue: ['bbq', 'barbecue'],
  burger: ['burger', 'hamburger'],
  brunch: ['brunch'],
  'fast-food': ['fast food'],
  café: ['cafe', 'coffee', 'coffee shop'],
  bar: ['bar', 'pub', 'lounge'],
  'bar à vins': ['wine bar'],
  cocktails: ['cocktail', 'cocktails'],
  boulangerie: ['bakery'],
  'salon de thé': ['tea room', 'tea house'],
  glacier: ['ice cream'],
  crêpes: ['creperie', 'crepe', 'crepes'],
  'fruits de mer': ['seafood', 'oyster'],
  végétarien: ['vegetarian'],
  végan: ['vegan'],
  halal: ['halal'],
};

const hasWord = (text, word) => new RegExp(`(^| )${escapeRegex(word)}( |$)`).test(text);

/**
 * @param {string[]} categories  catégories brutes (ex. ['french_restaurant', 'restaurant']) ou valeurs OSM (ex. ['french', 'pizza'])
 * @returns {{ cuisines: string[], tags: string[], vegan: boolean }}
 */
function fromCategories(categories) {
  // chaque catégorie est testée séparément, pour qu'un mot ne « déborde » pas sur la voisine
  const parts = (categories || []).map((c) => String(c).toLowerCase().replace(/[_;,]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const matches = (words) => parts.some((p) => words.some((w) => hasWord(p, w)));

  const cuisines = Object.entries(CUISINE_WORDS).filter(([, words]) => matches(words)).map(([name]) => name);
  const tags = Object.entries(TAG_WORDS).filter(([, words]) => matches(words)).map(([tag]) => tag);
  // `vegan` = « propose une option végé » (végétarien ou vegan) ; `halal` = restaurant halal
  return { cuisines, tags, vegan: matches(['vegan', 'vegetarian']), halal: matches(['halal']) };
}

// ---------- réseaux sociaux, sites, téléphones ----------
const SOCIAL_HOSTS = [
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['twitter', /(^|\.)(twitter\.com|x\.com)$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['tripadvisor', /(^|\.)tripadvisor\.[a-z.]+$/],
];

function parseHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 300) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

const socialNetworkOf = (url) => {
  const host = url.hostname.toLowerCase();
  const hit = SOCIAL_HOSTS.find(([, re]) => re.test(host));
  return hit ? hit[0] : null;
};

/** Premier lien trouvé pour chaque réseau social (http/https seulement). */
function socialLinks(urls) {
  const out = {};
  for (const value of urls || []) {
    const url = parseHttpUrl(value);
    const network = url && socialNetworkOf(url);
    if (network && !out[network]) out[network] = url.toString();
  }
  return out;
}

/** Sites web « normaux » : http(s), ni réseaux sociaux ni liens trop longs. */
function cleanWebsites(urls) {
  const seen = new Set();
  const out = [];
  for (const value of urls || []) {
    const url = parseHttpUrl(value);
    if (!url || socialNetworkOf(url)) continue;
    const href = url.toString();
    if (!seen.has(href) && href.length <= 300) {
      seen.add(href);
      out.push(href);
    }
  }
  return out;
}

function cleanPhones(phones) {
  const out = [];
  for (const p of phones || []) {
    const phone = typeof p === 'string' ? p.trim().replace(/\s+/g, ' ') : '';
    const digits = phone.replace(/\D/g, '').length;
    if (phone && phone.length <= 30 && digits >= 6 && digits <= 15 && !out.includes(phone)) out.push(phone);
  }
  return out;
}

// ---------- horaires OpenStreetMap -> format de l'appli ----------
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_CODES = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

function parseDays(selector) {
  const days = new Set();
  for (const part of selector.split(',')) {
    const m = part.trim().toLowerCase().match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (!m || !(m[1] in DAY_CODES) || (m[2] && !(m[2] in DAY_CODES))) return null;
    const from = DAY_CODES[m[1]];
    const to = m[2] ? DAY_CODES[m[2]] : from;
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
  }
  return [...days];
}

function parseTimes(text) {
  const slots = [];
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const [h1, m1, h2, m2] = m.slice(1).map(Number);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59 || (h1 === 24 && m1 > 0) || (h2 === 24 && m2 > 0)) return null;
    const hh = (n) => String(n % 24).padStart(2, '0'); // 24:00 devient 00:00
    const mm = (n) => String(n).padStart(2, '0');
    slots.push({ open: `${hh(h1)}:${mm(m1)}`, close: `${hh(h2)}:${mm(m2)}` });
  }
  return slots.length ? slots : null;
}

/**
 * Convertit le format d'horaires d'OpenStreetMap quand il est simple :
 *   "Mo-Fr 12:00-14:30,19:00-22:30; Sa 19:00-23:00; Su off"  ou  "24/7"  ou  "11:00-23:00"
 * Les jours fériés (PH) et vacances (SH) sont ignorés. Toute syntaxe plus complexe (semaines, mois,
 * lever / coucher du soleil, « + », commentaires...) renvoie null : mieux vaut aucun horaire qu'un faux.
 * @returns {{ weekly: object, text: string }|null}
 */
function parseOpeningHours(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 300) return null;
  const raw = text.trim();
  const weekly = Object.fromEntries(DAY_KEYS.map((k) => [k, []]));

  if (/^24\/7$/i.test(raw)) {
    DAY_KEYS.forEach((k) => (weekly[k] = [{ open: '00:00', close: '00:00' }]));
    return { weekly, text: raw };
  }

  let found = false;
  for (const rule of raw.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\- ]+?)?\s*(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i);
    if (!m) return null;
    const selector = (m[1] || '').replace(/\s+/g, '').trim();
    if (/^(ph|sh)(,(ph|sh))*$/i.test(selector)) continue; // jours fériés / vacances scolaires : ignorés
    if (/(ph|sh)/i.test(selector)) return null;
    const days = selector ? parseDays(selector) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const closed = /^(off|closed)$/i.test(m[2]);
    const slots = closed ? [] : parseTimes(m[2]);
    if (!closed && !slots) return null;
    for (const d of days) weekly[DAY_KEYS[d]] = slots; // une règle plus tardive remplace la précédente, comme dans OSM
    found = true;
  }
  return found ? { weekly, text: raw } : null;
}

// ---------- étiquettes OpenStreetMap ----------
const yes = (v) => ['yes', 'only'].includes(String(v || '').toLowerCase());

/** Tout ce qu'on sait tirer des « extratags » d'un lieu OpenStreetMap. */
function fromOsmTags(tags, country) {
  const t = tags || {};
  const first = (...keys) => keys.map((k) => t[k]).find((v) => typeof v === 'string' && v.trim());
  const cuisine = fromCategories(String(t.cuisine || '').split(';'));
  const extra = [];
  if (yes(t.outdoor_seating)) extra.push('terrasse');
  if (yes(t.takeaway)) extra.push('à emporter');
  if (yes(t.delivery)) extra.push('livraison');
  if (yes(t.wheelchair)) extra.push('accessible PMR');
  if (['wlan', 'wifi', 'yes', 'terminal'].includes(String(t.internet_access || '').toLowerCase())) extra.push('wifi');
  if (yes(t['diet:vegetarian'])) extra.push('végétarien');
  if (yes(t['diet:vegan'])) extra.push('végan');

  const websites = cleanWebsites([first('website', 'contact:website', 'url')]);
  // seuls les liens complets sont gardés (un simple « @pseudo » ne dit pas de quel réseau il s'agit)
  const socials = socialLinks([first('contact:facebook', 'facebook'), first('contact:instagram', 'instagram'), first('contact:twitter', 'twitter'), first('contact:tiktok'), first('contact:youtube')]);
  const hours = parseOpeningHours(t.opening_hours);

  return {
    phones: cleanPhones([first('phone', 'contact:phone', 'contact:mobile')]),
    websites,
    emails: [first('email', 'contact:email')].filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 100),
    socials,
    cuisines: cuisine.cuisines,
    tags: [...new Set([...cuisine.tags, ...extra])],
    vegan: yes(t['diet:vegan']) || yes(t['diet:vegetarian']) || cuisine.vegan,
    halal: yes(t['diet:halal']) || cuisine.halal,
    hours: hours ? { timezone: timezoneFor(country), weekly: hours.weekly, text: hours.text } : null,
  };
}

module.exports = { normalize, escapeRegex, timezoneFor, fromCategories, socialLinks, cleanWebsites, cleanPhones, parseOpeningHours, fromOsmTags };
