import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFeed } from '../hooks/useFeed.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import ListsPanel from '../components/ListsPanel.jsx'
import Loader from '../components/Loader.jsx'
import { MapPinIcon } from '../components/Icons.jsx'
import RestoCard from '../components/RestoCard.jsx'
import TrendChips from '../components/TrendChips.jsx'
import FeedReels from './FeedReels.jsx'
import { NEARBY_RADIUS_KM } from '../hooks/useFeed.js'
import { GEO_TEXT } from '../hooks/useGeolocation.js'


function FeedDesktop({ f }) {
  const { user, tag, cuisine, filterLabel, setFilter, geo, trends, cuisineNames, feed, load, loadMore, loadingMore } = f

  // Scroll aimanté entre les restos (uniquement sur cette page)
  useEffect(() => {
    document.documentElement.classList.add('snap-feed')
    return () => document.documentElement.classList.remove('snap-feed')
  }, [])

  return (
    <div className="wrap wrap--feed fade-in">
      <div className="feed-layout">
        <ListsPanel />

        <section className="feed-main" aria-labelledby="feed-title">
          <div className="feed-head">
            <span className="eyebrow">{user ? 'Ton fil' : 'Autour de toi'}</span>
            <h1 id="feed-title">{user ? `Salut ${user.username} !` : 'Les restos du moment'}</h1>
            <p>
              {user
                ? 'Une sélection faite pour toi, selon tes goûts.'
                : 'Tu explores en invité : crée un compte pour avoir un fil à ton goût.'}
            </p>
          </div>

          <div className="toolbar">
            {geo.status === 'granted' ? (
              <button type="button" className="pill" aria-pressed="true" onClick={geo.clear}>
                <MapPinIcon /> Autour de moi · désactiver
              </button>
            ) : (
              <button type="button" className="pill" onClick={geo.request} disabled={geo.status === 'asking'}>
                <MapPinIcon /> {geo.status === 'asking' ? 'Localisation…' : 'Autour de moi'}
              </button>
            )}
            {user && !user.preferences?.cuisines?.length && !user.preferences?.tags?.length && (
              <Link to="/preferences" className="pill">
                Régler mes goûts
              </Link>
            )}
            {filterLabel && (
              <button type="button" className="pill pill--filter" onClick={() => setFilter('tag', null)} aria-label={`Retirer le filtre ${filterLabel}`}>
                {filterLabel} ✕
              </button>
            )}
          </div>
          {GEO_TEXT[geo.status] && geo.status !== 'asking' && <p className="notice notice--soft">{GEO_TEXT[geo.status]}</p>}

          <div className="trends trends--strip" aria-label="Mots-clés tendance">
            <TrendChips trends={trends} tag={tag} cuisine={cuisine} onTag={(v) => setFilter('tag', v)} onCuisine={(v) => setFilter('cuisine', v)} />
          </div>

          {feed.widened && <p className="notice notice--soft">Rien à moins de {NEARBY_RADIUS_KM} km : voici les restos les plus proches.</p>}

          {feed.status === 'loading' && <Loader />}
          {feed.status === 'error' && (
            <div className="state">
              <h2>Les restos n’ont pas pu charger</h2>
              <p>Vérifie ta connexion, puis réessaie.</p>
              <button type="button" className="btn btn--primary" onClick={load}>
                Réessayer
              </button>
            </div>
          )}
          {feed.status === 'ok' && feed.items.length === 0 && (
            <div className="state">
              <h2>{filterLabel ? 'Aucun resto pour ce filtre' : 'Aucun resto pour l’instant'}</h2>
              <p>{filterLabel ? 'Essaie un autre mot-clé.' : 'Sois le premier à ajouter une bonne adresse !'}</p>
              {filterLabel ? (
                <button type="button" className="btn btn--secondary" onClick={() => setFilter('tag', null)}>
                  Retirer le filtre
                </button>
              ) : (
                <Link to="/ajouter" className="btn btn--primary">
                  Ajouter un resto
                </Link>
              )}
            </div>
          )}
          {feed.status === 'ok' && feed.items.length > 0 && (
            <>
              <div className="feed">
                {feed.items.map((r, i) => (
                  <RestoCard key={r._id} index={i % 8} resto={r} cuisineNames={(r.cuisines || []).map((id) => cuisineNames[id]).filter(Boolean)} />
                ))}
              </div>
              {feed.page < feed.pages && (
                <button type="button" className="btn btn--secondary btn--block feed__more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Chargement…' : 'Voir plus de restos'}
                </button>
              )}
            </>
          )}
        </section>

        <aside className="side side--trends" aria-labelledby="trends-title">
          <h2 id="trends-title" className="side__title">
            Ça cartonne
          </h2>
          <div className="trends trends--panel">
            <TrendChips trends={trends} tag={tag} cuisine={cuisine} onTag={(v) => setFilter('tag', v)} onCuisine={(v) => setFilter('cuisine', v)} />
          </div>
        </aside>
      </div>
    </div>
  )
}

// Téléphone : fil vertical plein écran façon TikTok ; ordinateur : cartes en colonnes
export default function Feed() {
  const feed = useFeed()
  const mobile = useMediaQuery('(max-width: 879px)')
  return mobile ? <FeedReels f={feed} /> : <FeedDesktop f={feed} />
}