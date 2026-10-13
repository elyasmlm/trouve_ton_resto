import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { useLists } from '../lists/useLists.js'
import { ListIcon } from './Icons.jsx'

// Colonne « Tes listes » à gauche du fil
export default function ListsPanel() {
  const { user } = useAuth()
  const { lists, status } = useLists()
  return (
    <aside className="side side--lists" aria-labelledby="lists-title">
      <h2 id="lists-title" className="side__title">
        <ListIcon /> Tes listes
      </h2>
      {user ? (
        <>
          {status === 'loading' && lists.length === 0 && <p className="side__hint">Chargement…</p>}
          <ul className="side__lists">
            {lists.slice(0, 6).map((l) => (
              <li key={l._id}>
                <Link to={`/listes/${l._id}`}>{l.name}</Link>
                <span className="side__count">{l.count}</span>
              </li>
            ))}
          </ul>
          <Link to="/listes" className="btn btn--secondary btn--small">
            Voir tout
          </Link>
        </>
      ) : (
        <>
          <p className="side__hint">Crée un compte pour ranger tes envies et tes restos testés dans des listes.</p>
          <Link to="/inscription" className="btn btn--primary btn--small">
            Commencer
          </Link>
        </>
      )}
    </aside>
  )
}