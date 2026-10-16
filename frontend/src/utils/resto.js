// Petits formateurs partagés par les cartes de resto (liste) et les écrans du fil mobile
export const fmt = (n) => n.toFixed(1).replace('.', ',')

export const distance = (m) =>
  m == null ? null : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`

export function mapsUrl(r) {
  const dest = r.geo ? `${r.geo.coordinates[1]},${r.geo.coordinates[0]}` : `${r.name} ${r.location.street} ${r.location.city}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}

export const isVideo = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(url || '')

// Seuls les liens http(s) sont acceptés comme site web
export const safeWebsite = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null)

// Mêmes règles que canEdit côté API : admin, propriétaire du resto, ou auteur tant que la fiche n'est pas vérifiée
export const canEditResto = (user, r) =>
  Boolean(user && (user.role === 'admin' || (user.restos || []).includes(r._id) || (!r.verified && r.added_by === user._id)))
