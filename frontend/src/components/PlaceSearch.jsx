import { useRef, useState } from 'react'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { SearchIcon } from './Icons.jsx'

// Cherche un lieu (OpenStreetMap, via notre serveur) pour préremplir adresse et position
export default function PlaceSearch({ onPick, onManual }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState({ status: 'idle', items: [], error: '' })
  const request = useRef(0)

  const submit = async (e) => {
    e.preventDefault()
    const query = q.trim()
    if (query.length < 3) return
    const id = ++request.current
    setState({ status: 'loading', items: [], error: '' })
    try {
      const res = await api.get('/places/search', { params: { q: query } })
      if (id === request.current) setState({ status: 'ok', items: res.data.items, error: '' })
    } catch (err) {
      if (id === request.current) setState({ status: 'error', items: [], error: errorMessage(err) })
    }
  }

  return (
    <div className="place">
      <form className="place__form" onSubmit={submit} role="search">
        <label htmlFor="place-q" className="place__label">
          Nom du resto et ville
        </label>
        <div className="place__row">
          <div className="search place__input">
            <SearchIcon />
            <input id="place-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Le Procope Paris" maxLength={100} autoComplete="off" enterKeyHint="search" />
          </div>
          <button className="btn btn--primary btn--small" disabled={q.trim().length < 3 || state.status === 'loading'}>
            {state.status === 'loading' ? 'Recherche…' : 'Chercher'}
          </button>
        </div>
      </form>

      {state.status === 'error' && (
        <p className="notice notice--soft" role="status">
          {state.error}
        </p>
      )}
      {state.status === 'ok' && state.items.length === 0 && (
        <p className="notice notice--soft" role="status">
          Aucun lieu trouvé. Essaie avec la ville, ou remplis à la main ci-dessous.
        </p>
      )}
      {state.items.length > 0 && (
        <ul className="place__results" aria-label="Lieux trouvés">
          {state.items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)}>
                <strong>{p.name}</strong>
                <span>{[p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || p.display_name}</span>
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