// Les filtres de recherche vivent dans l'adresse de la page (?q=pizza&price=1,2&view=map) : on peut partager un lien.
export const SORTS = [
  ['for_you', 'Pertinence'],
  ['distance', 'Distance'],
  ['rating', 'Mieux notés'],
  ['recent', 'Nouveautés'],
  ['price_asc', 'Prix croissant'],
  ['price_desc', 'Prix décroissant'],
  ['name', 'Nom A–Z'],
]
export const PRICES = [['1', '€'], ['2', '€€'], ['3', '€€€'], ['4', '€€€€']]
export const MEALS = [['breakfast', 'Petit-déj'], ['brunch', 'Brunch'], ['lunch', 'Déjeuner'], ['dinner', 'Dîner'], ['snack', 'Snack'], ['late_night', 'Tard le soir']]
export const RATINGS = [[0, 'Toutes'], [3, '3+'], [3.5, '3,5+'], [4, '4+'], [4.5, '4,5+']]
export const RADII = [1, 5, 10, 25]

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])
const number = (v) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

export function readFilters(params) {
  return {
    q: params.get('q') || '',
    cuisines: list(params.get('cuisine')),
    price: list(params.get('price')),
    meals: list(params.get('meal')),
    vegan: params.get('vegan') === '1',
    halal: params.get('halal') === '1',
    verified: params.get('verified') === '1',
    open: params.get('open') === 'now',
    minRating: number(params.get('minRating')) || 0,
    radius: number(params.get('radius')),
    sort: SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'for_you',
    view: params.get('view') === 'map' ? 'map' : 'list',
  }
}

export function writeFilters(f) {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.cuisines.length) p.set('cuisine', f.cuisines.join(','))
  if (f.price.length) p.set('price', f.price.join(','))
  if (f.meals.length) p.set('meal', f.meals.join(','))
  if (f.vegan) p.set('vegan', '1')
  if (f.halal) p.set('halal', '1')
  if (f.verified) p.set('verified', '1')
  if (f.open) p.set('open', 'now')
  if (f.minRating) p.set('minRating', String(f.minRating))
  if (f.radius) p.set('radius', String(f.radius))
  if (f.sort !== 'for_you') p.set('sort', f.sort)
  if (f.view === 'map') p.set('view', 'map')
  return p
}

// Paramètres de l'API de recherche. Le tri « distance » n'a de sens qu'avec une position.
export function apiParams(f, coords) {
  const p = {}
  if (f.q) p.q = f.q
  if (f.cuisines.length) p.cuisine = f.cuisines.join(',')
  if (f.price.length) p.price = f.price.join(',')
  if (f.meals.length) p.meal = f.meals.join(',')
  if (f.vegan) p.vegan = 'true'
  if (f.halal) p.halal = 'true'
  if (f.verified) p.verified = 'true'
  if (f.open) p.open = 'now'
  if (f.minRating) p.minRating = f.minRating
  if (coords) {
    p.lat = coords.lat
    p.lng = coords.lng
    if (f.radius) p.radius = f.radius
  }
  p.sort = f.sort === 'distance' && !coords ? 'for_you' : f.sort
  return p
}

// nombre de filtres actifs (hors texte, tri et vue)
export const activeCount = (f) =>
  f.cuisines.length + f.price.length + f.meals.length + [f.vegan, f.halal, f.verified, f.open].filter(Boolean).length + (f.minRating ? 1 : 0) + (f.radius ? 1 : 0)

export const EMPTY_FILTERS = readFilters(new URLSearchParams())