import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { BellIcon, ListIcon, LogoMark, PlusIcon, SearchIcon } from './Icons.jsx'
import { NAV_ITEMS } from './navItems.js'

function Brand() {
  return (
    <Link to="/" className="logo" aria-label="Trouve Ton Resto, accueil">
      <LogoMark className="logo__mark" />
      <span>
        Trouve Ton Resto
      </span>
    </Link>
  )
}

function SearchBar() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')

  const submit = (e) => {
    e.preventDefault()
    const query = q.trim()
    navigate(query ? `/recherche?q=${encodeURIComponent(query)}` : '/recherche')
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <SearchIcon />
      <input
        type="search"
        enterKeyHint="search"
        placeholder="Cherche ton resto…"
        aria-label="Chercher un resto"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  )
}

function Header() {
  const { user } = useAuth()
  return (
    <header className="header">
      <div className="header__inner">
        <Brand />
        <SearchBar />
        <div className="header__actions">
          <NavLink to="/listes" className="icon-btn header__desktop" aria-label="Mes listes">
            <ListIcon />
          </NavLink>
          <NavLink to="/ajouter" className="icon-btn header__desktop" aria-label="Ajouter un resto">
            <PlusIcon />
          </NavLink>
          {user ? (
            <>
              <NavLink to="/notifications" className="icon-btn" aria-label="Notifications">
                <BellIcon />
              </NavLink>
              <Link to="/compte" className="pdp header__desktop" aria-label="Mon compte">
                {user.username.charAt(0).toUpperCase()}
              </Link>
            </>
          ) : (
            <Link to="/connexion" className="btn btn--primary btn--small">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <ul className="tabbar__list">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, fab }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={fab ? 'tab tab--add' : 'tab'}>
              {fab ? (
                <span className="tab__fab">
                  <Icon />
                </span>
              ) : (
                <Icon />
              )}
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <Link to="/" className="logo">
            <LogoMark className="logo__mark" />
            <span>Trouve Ton Resto</span>
          </Link>
          <p>Des restos autour de toi, une recherche qui comprend vraiment ton envie.</p>
        </div>
        <div>
          <nav aria-label="Liens du pied de page">
            <Link to="/">Accueil</Link>
            <Link to="/recherche">Recherche</Link>
            <Link to="/ajouter">Ajouter un resto</Link>
          </nav>
          <small>© {new Date().getFullYear()} Trouve Ton Resto</small>
        </div>
      </div>
    </footer>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function Layout() {
  const { user, guest, loading } = useAuth()
  const { pathname } = useLocation()
  // La page d'accueil visiteur est une page de présentation : pas de barre du bas
  const landing = pathname === '/' && !user && !guest && !loading
  return (
    <div className={landing ? 'shell shell--landing' : 'shell'}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <ScrollToTop />
      <Header />
      <main id="contenu" className="main">
        <Outlet />
      </main>
      <Footer />
      {!landing && <TabBar />}
    </div>
  )
}