import { useId, useRef, useState } from 'react'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { MapPinIcon } from './Icons.jsx'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const hasHours = (p) => p.hours && DAYS.some((d) => p.hours.weekly?.[d]?.length)

// Ce que l'on sait déjà d'un lieu, résumé en petites pastilles pour aider à choisir
function Known({ place: p }) {
  const items = [
    p.phone && 'Téléphone',
    p.website && 'Site web',
    (p.socials?.instagram || p.socials?.facebook) && 'Réseaux',
    hasHours(p) && 'Horaires',
    p.email && 'E-mail',
  ].filter(Boolean)
  if (!items.length && !p.cuisines?.length) return null
  return (
    <span className="place__known">
      {p.cuisines?.slice(0, 2).map((c) => (
        <i key={c} className="place__tag place__tag--cuisine">
          {c}
        </i>
      ))}
      {items.map((x) => (
        <i key={x} className="place__tag">
          {x}
        </i>
      ))}
    </span>
  )
}

// Cherche un lieu (notre base de lieux + OpenStreetMap, via notre serveur) pour préremplir le formulaire
export default function PlaceSearch({ onPick, onManual }) {
  const nameId = useId()
  const cityId = useId()
  const geo = useGeolocation()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState({ status: 'idle', items: [], error: '' })
  const request = useRef(0)

  const near = geo.status === 'granted'
  const ready = name.trim().length >= 2 && (city.trim().length >= 2 || near || name.trim().length >= 4)

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    const id = ++request.current
    setState({ status: 'loading', items: [], error: '' })
    try {
      const params = { name: name.trim(), city: city.trim(), ...(near && { lat: geo.coords.lat, lng: geo.coords.lng }) }
      const res = await api.get('/places/search', { params })
      if (id === request.current) setState({ status: 'ok', items: res.data.items, error: '' })
    } catch (err) {
      if (id === request.current) setState({ status: 'error', items: [], error: errorMessage(err) })
    }
  }

  return (
    <div className="place">
      <form className="place__form" onSubmit={submit} role="search">
        <div className="form-grid">
          <div className="field">
            <label htmlFor={nameId}>Nom du resto</label>
            <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Le Procope" maxLength={100} autoComplete="off" enterKeyHint="search" />
          </div>
          <div className="field">
            <label htmlFor={cityId}>Ville</label>
            <input id={cityId} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Paris" maxLength={100} autoComplete="address-level2" enterKeyHint="search" />
          </div>
        </div>
        <div className="place__actions">
          <button className="btn btn--primary" disabled={!ready || state.status === 'loading'}>
            {state.status === 'loading' ? 'Recherche…' : 'Chercher'}
          </button>
          {near ? (
            <button type="button" className="pill" aria-pressed="true" onClick={geo.clear}>
              <MapPinIcon /> Autour de moi · désactiver
            </button>
          ) : (
            <button type="button" className="pill" onClick={geo.request} disabled={geo.status === 'asking'}>
              <MapPinIcon /> {geo.status === 'asking' ? 'Localisation…' : 'Autour de moi'}
            </button>
          )}
        </div>
      </form>

      {state.status === 'error' && (
        <p className="notice notice--soft" role="status">
          {state.error}
        </p>
      )}
      {state.status === 'ok' && state.items.length === 0 && (
        <p className="notice notice--soft" role="status">
          Aucun lieu trouvé. Essaie avec moins de mots, vérifie la ville, ou remplis à la main ci-dessous.
        </p>
      )}
      {state.items.length > 0 && (
        <ul className="place__results" aria-label="Lieux trouvés">
          {state.items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)}>
                <strong>{p.name}</strong>
                <span>{[p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || p.display_name}</span>
                <Known place={p} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--secondary btn--block" onClick={onManual}>
        Je remplis moi-même
      </button>
    </div>
  )
}
