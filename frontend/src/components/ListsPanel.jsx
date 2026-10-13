import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { ListIcon } from './Icons.jsx'

// Aperçu de la colonne « Tes listes » (les vraies listes arrivent avec l'issue Listes)
export default function ListsPanel() {
  const { user } = useAuth()
  return (
    <aside className="side side--lists" aria-labelledby="lists-title">
      <h2 id="lists-title" className="side__title">
        <ListIcon /> Tes listes
      </h2>
      {user ? (
        <>
          <ul className="side__lists">
            <li>
              <Link to="/listes">Ma wishlist</Link>
              <span className="tag">Bientôt</span>
            </li>
            <li>
              <Link to="/listes">Déjà testés</Link>
              <span className="tag">Bientôt</span>
            </li>
          </ul>
          <p className="side__hint">Garde tes envies et tes bonnes adresses au même endroit.</p>
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