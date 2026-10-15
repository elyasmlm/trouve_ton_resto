import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { useLists } from '../lists/useLists.js'
import { apiParams } from '../utils/searchParams.js'
import { distance, fmt, mapsUrl } from '../utils/resto.js'
import { ListPlusIcon, MapIcon } from './Icons.jsx'

// Fond de carte OpenStreetMap (usage modéré). Pour un fort trafic, mettre son propre fournisseur dans VITE_TILE_URL.
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const FRANCE = [46.6, 2.4]
const MIN_ZOOM_FETCH = 9

const pin = (cls) => L.divIcon({ className: 'pin-wrap', html: `<span class="pin ${cls}"></span>`, iconSize: [30, 36], iconAnchor: [15, 34] })
const ICONS = { normal: pin(''), selected: pin('pin--on'), sponsored: pin('pin--sponso'), sponsoredOn: pin('pin--sponso pin--on') }

// Recharge les restos de la zone visible quand la carte s'arrête de bouger (ou quand les filtres changent)
function Loader({ filters, coords, onData, onState }) {
  const map = useMap()
  const request = useRef(0)
  const first = useRef(true)

  const load = useCallback(() => {
    const id = ++request.current
    const zoomedOut = map.getZoom() < MIN_ZOOM_FETCH
    if (zoomedOut && !first.current) {
      onState('far')
      return
    }
    const b = map.getBounds()
    const bbox = zoomedOut ? {} : { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(',') }
    onState('loading')
    api
      .get('/restos', { params: { ...apiParams(filters, coords), ...bbox, view: 'map' } })
      .then(({ data }) => {
        if (id !== request.current) return
        onData(data)
        onState('ok')
        // première ouverture sans position : on cadre les résultats
        if (first.current && !coords && data.items.length) {
          const pts = data.items.filter((r) => r.geo).map((r) => [r.geo.coordinates[1], r.geo.coordinates[0]])
          if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 })
        }
        first.current = false
      })
      .catch(() => id === request.current && onState('error'))
  }, [map, filters, coords, onData, onState])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useMapEvents({ moveend: () => !first.current && load() })
  return null
}

function Recenter({ coords }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (coords && !done.current) {
      done.current = true
      map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 13))
    }
  }, [coords, map])
  return null
}

function Preview({ resto: r, cuisineNames, onClose }) {
  const { user } = useAuth()
  const { isSaved, openSheet } = useLists()
  const location = useLocation()
  const cuisines = (r.cuisines || []).map((id) => cuisineNames[id]).filter(Boolean)
  const dist = distance(r.distance)
  const traits = [r.halal_certificate && 'Halal', r.vegan && 'Végé', r.verified && 'Vérifié', r.is_open === true && 'Ouvert', r.is_open === false && 'Fermé'].filter(Boolean)
  return (
    <aside className="mapcard" aria-label={`Aperçu : ${r.name}`}>
      <button type="button" className="mapcard__close" onClick={onClose} aria-label="Fermer l’aperçu">
        ✕
      </button>
      <h3>{r.name}</h3>
      <p className="mapcard__meta">
        {[cuisines.join(', '), r.price_range, r.rating_avg != null && `★ ${fmt(r.rating_avg)}`, dist].filter(Boolean).join(' · ')}
      </p>
      <p className="mapcard__meta">{[r.location?.street, [r.location?.zip, r.location?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
      {traits.length > 0 && (
        <div className="traits">
          {traits.map((t) => (
            <span className="trait" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="actions">
        <a href={mapsUrl(r)} target="_blank" rel="noopener noreferrer">
          <MapIcon /> Itinéraire
        </a>
        {user ? (
          <button type="button" onClick={() => openSheet(r)}>
            <ListPlusIcon /> {isSaved(r._id) ? 'Dans mes listes' : 'Garder'}
          </button>
        ) : (
          <Link to="/connexion" state={{ from: location.pathname + location.search, notice: 'Connecte-toi pour utiliser tes listes.' }}>
            <ListPlusIcon /> Garder
          </Link>
        )}
      </div>
    </aside>
  )
}

export default function SearchMap({ filters, coords, cuisineNames }) {
  const [data, setData] = useState({ items: [], total: 0 })
  const [state, setState] = useState('loading')
  const [selected, setSelected] = useState(null)
  const onData = useCallback((d) => setData(d), [])
  const onState = useCallback((s) => setState(s), [])
  const points = useMemo(() => data.items.filter((r) => r.geo?.coordinates), [data])
  const current = points.find((r) => r._id === selected)
  const box = useRef(null)
  const pick = (id) => {
    setSelected(id)
    box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) // la fiche d'aperçu ne doit pas finir sous la barre du bas
  }

  const status =
    state === 'far'
      ? 'Zoome pour voir les restos de la zone.'
      : state === 'error'
        ? 'La carte n’a pas pu charger les restos.'
        : state === 'loading'
          ? 'Chargement…'
          : data.total > data.items.length
            ? `${data.items.length} restos affichés sur ${data.total} : zoome pour tout voir.`
            : `${data.total} resto${data.total > 1 ? 's' : ''} dans cette zone`

  return (
    <div className="searchmap" ref={box}>
      <MapContainer center={coords ? [coords.lat, coords.lng] : FRANCE} zoom={coords ? 13 : 6} minZoom={4} scrollWheelZoom className="searchmap__map" attributionControl>
        <TileLayer url={TILE_URL} maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">les contributeurs d’OpenStreetMap</a>' />
        <Loader filters={filters} coords={coords} onData={onData} onState={onState} />
        <Recenter coords={coords} />
        {coords && <CircleMarker center={[coords.lat, coords.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2b6cb0', fillOpacity: 1 }} interactive={false} />}
        {points.map((r) => (
          <Marker
            key={r._id}
            position={[r.geo.coordinates[1], r.geo.coordinates[0]]}
            icon={r.sponsored ? (r._id === selected ? ICONS.sponsoredOn : ICONS.sponsored) : r._id === selected ? ICONS.selected : ICONS.normal}
            title={r.name}
            keyboard
            eventHandlers={{ click: () => pick(r._id) }}
          />
        ))}
      </MapContainer>
      <p className="searchmap__status" role="status">
        {status}
      </p>
      {current && <Preview resto={current} cuisineNames={cuisineNames} onClose={() => setSelected(null)} />}
    </div>
  )
}