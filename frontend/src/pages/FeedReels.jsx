import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GEO_TEXT } from '../hooks/useGeolocation.js'
import { BellIcon, LogoMark, SearchIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import ReelCard from '../components/ReelCard.jsx'
import TrendChips from '../components/TrendChips.jsx'

// Fil vertical plein écran (téléphone) : un resto par écran, comme une vidéo TikTok
export default function FeedReels({ f }) {
  const { user, tag, cuisine, filterLabel, setFilter, geo, trends, cuisineNames, feed, load, loadMore, loadingMore } = f
  const scroller = useRef(null)
  const sentinel = useRef(null)
  const near = geo.status === 'granted'

  // la page elle-même ne défile pas : seul le fil le fait
  useEffect(() => {
    document.documentElement.classList.add('reels-mode')
    return () => document.documentElement.classList.remove('reels-mode')
  }, [])

  // charge la suite quand on approche de la fin
  const hasMore = feed.page < feed.pages
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loadingMore) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { root: scroller.current, rootMargin: '0px 0px 120% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadingMore, loadMore, feed.items.length])

  const status = feed.status
  return (
    <>
      <header className="reels__top">
        <div className="reels__bar">
          <Link to="/" aria-label="Trouve Ton Resto" className="reels__logo">
            <LogoMark />
          </Link>
          <div className="reels__tabs" role="tablist" aria-label="Type de fil">
            <button type="button" role="tab" aria-selected={!near} onClick={near ? geo.clear : undefined}>
              Pour toi
            </button>
            <button type="button" role="tab" aria-selected={near} onClick={near ? undefined : geo.request} disabled={geo.status === 'asking'}>
              {geo.status === 'asking' ? 'Localisation…' : 'Autour de moi'}
            </button>
          </div>
          <Link to="/recherche" className="reels__icon" aria-label="Rechercher">
            <SearchIcon />
          </Link>
          {user ? (
            <Link to="/notifications" className="reels__icon" aria-label="Notifications">
              <BellIcon />
            </Link>
          ) : (
            <Link to="/connexion" className="reels__login">
              Connexion
            </Link>
          )}
        </div>
        {GEO_TEXT[geo.status] && geo.status !== 'asking' && <p className="reels__note">{GEO_TEXT[geo.status]}</p>}
        {feed.widened && <p className="reels__note">Rien à côté : voici les restos les plus proches.</p>}
        <div className="reels__chips">
          <TrendChips trends={trends} tag={tag} cuisine={cuisine} onTag={(v) => setFilter('tag', v)} onCuisine={(v) => setFilter('cuisine', v)} />
        </div>
      </header>

      <div className="reels" ref={scroller} tabIndex={0} role="feed" aria-busy={status === 'loading'} aria-label="Fil de restos">
        {status === 'loading' && feed.items.length === 0 && (
          <div className="reel reel--status">
            <Loader />
          </div>
        )}
        {status === 'error' && (
          <div className="reel reel--status">
            <h2>Les restos n’ont pas pu charger</h2>
            <p>Vérifie ta connexion, puis réessaie.</p>
            <button type="button" className="btn btn--primary" onClick={load}>
              Réessayer
            </button>
          </div>
        )}
        {status === 'ok' && feed.items.length === 0 && (
          <div className="reel reel--status">
            <h2>{filterLabel ? 'Aucun resto pour ce filtre' : 'Aucun resto pour l’instant'}</h2>
            <p>{filterLabel ? 'Essaie un autre mot-clé.' : 'Sois le premier à ajouter une bonne adresse !'}</p>
            {filterLabel ? (
              <button type="button" className="btn btn--primary" onClick={() => setFilter('tag', null)}>
                Retirer le filtre
              </button>
            ) : (
              <Link to="/ajouter" className="btn btn--primary">
                Ajouter un resto
              </Link>
            )}
          </div>
        )}

        {feed.items.map((r) => (
          <ReelCard key={r._id} resto={r} cuisineNames={(r.cuisines || []).map((id) => cuisineNames[id]).filter(Boolean)} onTag={(t) => setFilter('tag', t)} />
        ))}

        {status === 'ok' && feed.items.length > 0 && (hasMore ? <div ref={sentinel} className="reel reel--status" aria-hidden="true"><Loader /></div> : (
          <div className="reel reel--status">
            <h2>Tu as tout vu !</h2>
            <p>Reviens plus tard, ou ajoute une bonne adresse que tu connais.</p>
            <Link to="/ajouter" className="btn btn--primary">
              Ajouter un resto
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}