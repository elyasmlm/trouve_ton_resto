import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import FilterPanel from '../components/FilterPanel.jsx'
import { MapIcon, MapPinIcon, SlidersIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import RestoCard from '../components/RestoCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { GEO_TEXT, useGeolocation } from '../hooks/useGeolocation.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { useSearchResults } from '../hooks/useSearchResults.js'
import { activeCount, EMPTY_FILTERS, MEALS, PRICES, readFilters, SORTS, writeFilters } from '../utils/searchParams.js'

const SearchMap = lazy(() => import('../components/SearchMap.jsx'))

// Les filtres actifs, retirables un par un
function activeChips(f, set) {
  const chips = []
  f.cuisines.forEach((c) => chips.push([`c-${c}`, c, () => set({ cuisines: f.cuisines.filter((x) => x !== c) })]))
  f.price.forEach((p) => chips.push([`p-${p}`, PRICES.find(([v]) => v === p)?.[1] || p, () => set({ price: f.price.filter((x) => x !== p) })]))
  f.meals.forEach((m) => chips.push([`m-${m}`, MEALS.find(([v]) => v === m)?.[1] || m, () => set({ meals: f.meals.filter((x) => x !== m) })]))
  if (f.halal) chips.push(['halal', 'Halal', () => set({ halal: false })])
  if (f.vegan) chips.push(['vegan', 'Option végé', () => set({ vegan: false })])
  if (f.verified) chips.push(['verified', 'Vérifiés', () => set({ verified: false })])
  if (f.open) chips.push(['open', 'Ouvert maintenant', () => set({ open: false })])
  if (f.minRating) chips.push(['rating', `★ ${f.minRating}+`, () => set({ minRating: 0 })])
  if (f.radius) chips.push(['radius', `${f.radius} km`, () => set({ radius: null })])
  return chips
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const geo = useGeolocation()
  const coords = geo.status === 'granted' ? geo.coords : null
  const wide = useMediaQuery('(min-width: 880px)')
  const sheet = useRef(null)
  const [cuisineNames, setCuisineNames] = useState({})
  const results = useSearchResults(filters, coords)
  const cuisineList = useMemo(() => Object.values(cuisineNames).sort((a, b) => a.localeCompare(b, 'fr')), [cuisineNames])

  useEffect(() => {
    api
      .get('/cuisines')
      .then((c) => setCuisineNames(Object.fromEntries(c.data.items.map((x) => [x._id, x.cuisine_name]))))
      .catch(() => {})
  }, [])

  const set = useCallback((patch) => setParams(writeFilters({ ...readFilters(params), ...patch }), { replace: true }), [params, setParams])
  const reset = () => setParams(writeFilters({ ...EMPTY_FILTERS, q: filters.q, view: filters.view, sort: filters.sort }), { replace: true })

  const count = activeCount(filters)
  const chips = activeChips(filters, set)
  const showSort = SORTS.filter(([k]) => k !== 'distance' || coords)
  const filterPanel = <FilterPanel filters={filters} set={set} cuisines={cuisineList} hasPosition={!!coords} onLocate={geo.request} />

  return (
    <div className="wrap wrap--feed search-page fade-in">
      <div className="search-head">
        <span className="eyebrow">Recherche</span>
        <h1>{filters.q ? `« ${filters.q} »` : 'Trouve ton resto'}</h1>
        <SearchBar value={filters.q} onCommit={(q) => set({ q })} onPickCuisine={(c) => set({ q: '', cuisines: filters.cuisines.includes(c) ? filters.cuisines : [...filters.cuisines, c] })} />
      </div>

      <div className="toolbar search-tools">
        {!wide && (
          <button type="button" className="pill" onClick={() => sheet.current?.showModal()}>
            <SlidersIcon /> Filtres{count > 0 && <b className="admin__badge">{count}</b>}
          </button>
        )}
        {coords ? (
          <button type="button" className="pill" aria-pressed="true" onClick={geo.clear}>
            <MapPinIcon /> Autour de moi · désactiver
          </button>
        ) : (
          <button type="button" className="pill" onClick={geo.request} disabled={geo.status === 'asking'}>
            <MapPinIcon /> {geo.status === 'asking' ? 'Localisation…' : 'Autour de moi'}
          </button>
        )}
        <label className="sortsel">
          <span>Trier</span>
          <select value={filters.sort === 'distance' && !coords ? 'for_you' : filters.sort} onChange={(e) => set({ sort: e.target.value })}>
            {showSort.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="viewtoggle" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={filters.view === 'list'} onClick={() => set({ view: 'list' })}>
            Liste
          </button>
          <button type="button" aria-pressed={filters.view === 'map'} onClick={() => set({ view: 'map' })}>
            <MapIcon /> Carte
          </button>
        </div>
      </div>
      {GEO_TEXT[geo.status] && geo.status !== 'asking' && <p className="notice notice--soft">{GEO_TEXT[geo.status]}</p>}

      {chips.length > 0 && (
        <ul className="pills active-chips" aria-label="Filtres actifs">
          {chips.map(([key, label, remove]) => (
            <li key={key}>
              <button type="button" className="pill pill--filter" onClick={remove} aria-label={`Retirer le filtre ${label}`}>
                {label} ✕
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="btn btn--link" onClick={reset}>
              Tout réinitialiser
            </button>
          </li>
        </ul>
      )}

      <div className="search-layout">
        {wide && (
          <aside className="side search-filters" aria-label="Filtres">
            <h2 className="side__title">Filtres</h2>
            {filterPanel}
          </aside>
        )}

        <section className="search-main" aria-live="polite">
          {filters.view === 'map' ? (
            <Suspense fallback={<Loader />}>
              <SearchMap filters={filters} coords={coords} cuisineNames={cuisineNames} />
            </Suspense>
          ) : (
            <>
              {results.status === 'ok' && <p className="search-count">{results.total} resto{results.total > 1 ? 's' : ''}</p>}
              {results.status === 'loading' && !results.items.length && <Loader />}
              {results.status === 'error' && (
                <div className="state">
                  <h2>La recherche n’a pas pu aboutir</h2>
                  <p>Vérifie ta connexion, puis réessaie.</p>
                  <button type="button" className="btn btn--primary" onClick={results.reload}>
                    Réessayer
                  </button>
                </div>
              )}
              {results.status === 'ok' && results.items.length === 0 && (
                <div className="state">
                  <h2>Aucun resto trouvé</h2>
                  <p>{count || filters.q ? 'Essaie avec moins de filtres ou un autre mot.' : 'Sois le premier à ajouter une bonne adresse !'}</p>
                  {(count > 0 || filters.q) && (
                    <button type="button" className="btn btn--secondary" onClick={() => setParams(writeFilters({ ...EMPTY_FILTERS, view: filters.view }), { replace: true })}>
                      Tout effacer
                    </button>
                  )}
                </div>
              )}
              {results.items.length > 0 && (
                <>
                  <div className={`feed search-feed ${results.status === 'loading' ? 'is-stale' : ''}`}>
                    {results.items.map((r, i) => (
                      <RestoCard key={r._id} index={i % 8} resto={r} cuisineNames={(r.cuisines || []).map((id) => cuisineNames[id]).filter(Boolean)} />
                    ))}
                  </div>
                  {results.page < results.pages && (
                    <button type="button" className="btn btn--secondary btn--block feed__more" onClick={results.loadMore} disabled={results.loadingMore}>
                      {results.loadingMore ? 'Chargement…' : 'Voir plus de restos'}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {!wide && (
        <dialog ref={sheet} className="sheet" aria-labelledby="filters-title" onClick={(e) => e.target === sheet.current && sheet.current.close()}>
          <div className="sheet__inner">
            <div className="sheet__head">
              <h2 id="filters-title">Filtres</h2>
              <button type="button" className="btn btn--link" onClick={() => sheet.current.close()}>
                Fermer
              </button>
            </div>
            {filterPanel}
            <div className="mod__actions">
              <button type="button" className="btn btn--primary" onClick={() => sheet.current.close()}>
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
      )}
    </div>
  )
}