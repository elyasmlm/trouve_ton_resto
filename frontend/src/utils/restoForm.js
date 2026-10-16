export const COUNTRIES = [['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['LU', 'Luxembourg'], ['CA', 'Canada'], ['MA', 'Maroc'], ['DZ', 'Algérie'], ['TN', 'Tunisie'], ['ES', 'Espagne'], ['IT', 'Italie'], ['PT', 'Portugal'], ['DE', 'Allemagne'], ['GB', 'Royaume-Uni']]
export const MEALS = [['breakfast', 'Petit-déj'], ['brunch', 'Brunch'], ['lunch', 'Déjeuner'], ['dinner', 'Dîner'], ['snack', 'Snack'], ['late_night', 'Tard le soir']]
export const PRICES = [['€', 'Petit prix'], ['€€', 'Abordable'], ['€€€', 'On se fait plaisir'], ['€€€€', 'Grande occasion']]
export const WEEK = [['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche']]

export const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

// « instagram.com/monresto » -> « https://instagram.com/monresto » ; ce qui n'est pas un lien valide est ignoré
export function asUrl(value) {
  const v = value.trim()
  if (!v) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return url.hostname.includes('.') ? url.toString() : undefined
  } catch {
    return undefined
  }
}

// Les adresses saisies à la main n'ont pas de coordonnées : on essaie de les retrouver (sans bloquer si ça échoue)
export async function locate(api, form) {
  try {
    const res = await api.get('/places/search', { params: { q: `${form.street}, ${form.zip} ${form.city}` } })
    const hit = res.data.items[0]
    return hit ? { lat: hit.lat, lng: hit.lng } : null
  } catch {
    return null
  }
}

export const tagList = (text) => text.split(/[,#\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 15)
