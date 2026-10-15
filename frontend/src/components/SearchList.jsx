import { useEffect } from 'react'
import Loader from './Loader.jsx'
import RestoCard from './RestoCard.jsx'
import { useSearchResults } from '../hooks/useSearchResults.js'

// Résultats en liste (défile à l'intérieur de la page de recherche)
export default function SearchList({ filters, coords, cuisineNames, filtered, onStatus, onClear }) {
  const results = useSearchResults(filters, coords)
  const { status, total } = results

  useEffect(() => {
    onStatus(status === 'ok' ? `${total} resto${total > 1 ? 's' : ''}` : status === 'error' ? '' : 'Recherche…')
  }, [status, total, onStatus])

  return (
    <div className="sp__list">
      {status === 'loading' && !results.items.length && <Loader />}
      {status === 'error' && (
        <div className="state">
          <h2>La recherche n’a pas pu aboutir</h2>
          <p>Vérifie ta connexion, puis réessaie.</p>
          <button type="button" className="btn btn--primary" onClick={results.reload}>
            Réessayer
          </button>
        </div>
      )}
      {status === 'ok' && results.items.length === 0 && (
        <div className="state">
          <h2>Aucun resto trouvé</h2>
          <p>{filtered ? 'Essaie avec moins de filtres ou un autre mot.' : 'Sois le premier à ajouter une bonne adresse !'}</p>
          {filtered && (
            <button type="button" className="btn btn--secondary" onClick={onClear}>
              Tout effacer
            </button>
          )}
        </div>
      )}
      {results.items.length > 0 && (
        <>
          <div className={`feed ${status === 'loading' ? 'is-stale' : ''}`}>
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
    </div>
  )
}