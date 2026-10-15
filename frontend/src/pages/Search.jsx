import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import FilterPanel from '../components/FilterPanel.jsx'
import { MapIcon, MapPinIcon, SlidersIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import SearchBar from '../components/SearchBar.jsx'
import SearchList from '../components/SearchList.jsx'
import { useDragScroll } from '../hooks/useDragScroll.js'
import { GEO_TEXT, useGeolocation } from '../hooks/useGeolocation.js'
import { activeCount, EMPTY_FILTERS, MEALS, PRICES, readFilters, writeFilters } from '../utils/searchParams.js'

const SearchMap = lazy(() => import('../components/SearchMap.jsx'))
const RowsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
)
const without = (arr, v) => arr.filter((x) => x !== v)
const uniq = (arr) => [...new Set(arr)]

function Chip({ on, onClick, children, tag, removable }) {
  return (
    <button type="button" className={`pill sp__chip ${tag ? 'pill--tag' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
      {removable && <span aria-hidden="true"> ✕</span>}
    </button>
  )
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const location = useLocation()
  const geo = useGeolocation()
  const coords = geo.status === 'granted' ? geo.coords : null
  const dialog = useRef(null)
  const chips = useDragScroll()
  const [cuisineNames, setCuisineNames] = useState({})
  const [trends, setTrends] = useState({ tags: [], cuisines: [] })
  const [status, setStatus] = useState('')

  // la page occupe tout l'écran (comme le fil mobile) : pas de pied de page, pas d'en-tête sur téléphone
  useEffect(() => {
    document.documentElement.classList.add('search-mode')
    return () => document.documentElement.classList.remove('search-mode')
  }, [])

  useEffect(() => {
    Promise.all([api.get('/cuisines'), api.get('/trends')])
      .then(([c, t]) => {
        setCuisineNames(Object.fromEntries(c.data.items.map((x) => [x._id, x.cuisine_name])))
        setTrends(t.data)
      })
      .catch(() => {})
  }, [])

  const set = useCallback((patch) => setParams(writeFilters({ ...readFilters(params), ...patch }), { replace: true }), [params, setParams])
  const reset = () => setParams(writeFilters({ ...EMPTY_FILTERS, q: filters.q, view: filters.view, sort: filters.sort }), { replace: true })
  const clearAll = useCallback(() => setParams(writeFilters({ ...EMPTY_FILTERS, view: filters.view }), { replace: true }), [filters.view, setParams])
  const onStatus = useCallback((s) => setStatus(s), [])

  const toggle = (key, v) => set({ [key]: filters[key].includes(v) ? without(filters[key], v) : [...filters[key], v] })
  const count = activeCount(filters)
  const cuisineList = useMemo(() => Object.values(cuisineNames).sort((a, b) => a.localeCompare(b, 'fr')), [cuisineNames])
  const quickCuisines = uniq([...trends.cuisines.map((c) => c.name).slice(0, 6), ...filters.cuisines])
  const tagList = uniq(trends.tags.map((t) => t.tag))
  const quickTags = uniq([...tagList.slice(0, 8), ...filters.tags])
  const map = filters.view === 'map'

  return (
    <div className={`sp ${map ? 'sp--map' : 'sp--list'}`}>
      <h1 className="sr-only">Recherche de restos</h1>
      <div className="sp__bar">
        <div className="sp__row">
          <SearchBar
            value={filters.q}
            autoFocus={!!location.state?.focus}
            onCommit={(q) => set({ q })}
            onPickCuisine={(c) => set({ q: '', cuisines: uniq([...filters.cuisines, c]) })}
            onPickTag={(t) => set({ q: '', tags: uniq([...filters.tags, t]) })}
          />
          <button type="button" className="sp__filters" onClick={() => dialog.current?.showModal()} aria-label={count ? `Filtres et tri, ${count} actif${count > 1 ? 's' : ''}` : 'Filtres et tri'}>
            <SlidersIcon />
            {count > 0 && <b>{count}</b>}
          </button>
        </div>

        <div className="sp__chips" ref={chips} role="group" aria-label="Filtres rapides">
          {coords ? (
            <Chip on onClick={geo.clear}>
              <MapPinIcon /> Autour de moi
            </Chip>
          ) : (
            <Chip on={false} onClick={geo.request}>
              <MapPinIcon /> {geo.status === 'asking' ? 'Localisation…' : 'Autour de moi'}
            </Chip>
          )}
          <Chip on={filters.open} onClick={() => set({ open: !filters.open })}>Ouvert</Chip>
          <Chip on={filters.halal} onClick={() => set({ halal: !filters.halal })}>Halal</Chip>
          <Chip on={filters.vegan} onClick={() => set({ vegan: !filters.vegan })}>Végé</Chip>
          {filters.verified && <Chip on removable onClick={() => set({ verified: false })}>Vérifiés</Chip>}
          {filters.price.map((p) => (
            <Chip key={`p${p}`} on removable onClick={() => set({ price: without(filters.price, p) })}>{PRICES.find(([v]) => v === p)?.[1] || p}</Chip>
          ))}
          {filters.meals.map((m) => (
            <Chip key={`m${m}`} on removable onClick={() => set({ meals: without(filters.meals, m) })}>{MEALS.find(([v]) => v === m)?.[1] || m}</Chip>
          ))}
          {filters.minRating > 0 && <Chip on removable onClick={() => set({ minRating: 0 })}>★ {filters.minRating}+</Chip>}
          {filters.radius && <Chip on removable onClick={() => set({ radius: null })}>{filters.radius} km</Chip>}
          {quickCuisines.map((c) => (
            <Chip key={`c${c}`} on={filters.cuisines.includes(c)} onClick={() => toggle('cuisines', c)}>{c}</Chip>
          ))}
          {quickTags.map((t) => (
            <Chip key={`t${t}`} tag on={filters.tags.includes(t)} onClick={() => toggle('tags', t)}>#{t}</Chip>
          ))}
        </div>

        {GEO_TEXT[geo.status] && geo.status !== 'asking' && <p className="sp__note">{GEO_TEXT[geo.status]}</p>}
        {status && <p className="sp__status" role="status">{status}</p>}
      </div>

      <div className="sp__body">
        {map ? (
          <Suspense fallback={<Loader />}>
            <SearchMap filters={filters} coords={coords} cuisineNames={cuisineNames} onStatus={onStatus} />
          </Suspense>
        ) : (
          <SearchList filters={filters} coords={coords} cuisineNames={cuisineNames} filtered={count > 0 || !!filters.q} onStatus={onStatus} onClear={clearAll} />
        )}
      </div>

      <button type="button" className="sp__toggle" onClick={() => set({ view: map ? 'list' : 'map' })}>
        {map ? <RowsIcon /> : <MapIcon />} {map ? 'Liste' : 'Carte'}
      </button>

      <dialog ref={dialog} className="sheet" aria-labelledby="filters-title" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <div className="sheet__inner">
          <div className="sheet__head">
            <h2 id="filters-title">Filtres et tri</h2>
            <button type="button" className="btn btn--link" onClick={() => dialog.current.close()}>
              Fermer
            </button>
          </div>
          <FilterPanel filters={filters} set={set} cuisines={cuisineList} tags={tagList} hasPosition={!!coords} onLocate={geo.request} />
          <div className="mod__actions sp__done">
            <button type="button" className="btn btn--primary" onClick={() => dialog.current.close()}>
              Voir les restos
            </button>
            {count > 0 && (
              <button type="button" className="btn btn--link" onClick={reset}>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  )
}