import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import ListsPanel from '../components/ListsPanel.jsx'
import Loader from '../components/Loader.jsx'
import { MapPinIcon } from '../components/Icons.jsx'
import RestoCard from '../components/RestoCard.jsx'
import TrendChips from '../components/TrendChips.jsx'

const PAGE_SIZE = 8
const NEARBY_RADIUS_KM = 25

const GEO_TEXT = {
  asking: 'Recherche de ta position…',
  denied: 'Position refusée. Tu peux l’autoriser dans les réglages de ton navigateur.',
  error: 'Impossible de te localiser pour l’instant.',
  unavailable: 'Ton navigateur ne gère pas la géolocalisation.',
}

export default function Feed() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tag = params.get('tag')
  const cuisine = params.get('cuisine')
  const geo = useGeolocation()
  const lat = geo.coords?.lat
  const lng = geo.coords?.lng
  const prefsKey = JSON.stringify(user?.preferences || null)

  const [trends, setTrends] = useState({ tags: [], cuisines: [] })
  const [cuisineNames, setCuisineNames] = useState({})
  const [feed, setFeed] = useState({ status: 'loading', items: [], page: 1, pages: 1, widened: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const request = useRef(0)

  // Scroll aimanté entre les restos (uniquement sur cette page)
  useEffect(() => {
    document.documentElement.classList.add('snap-feed')
    return () => document.documentElement.classList.remove('snap-feed')
  }, [])

  useEffect(() => {
    Promise.all([api.get('/trends'), api.get('/cuisines')])
      .then(([t, c]) => {
        setTrends(t.data)
        setCuisineNames(Object.fromEntries(c.data.items.map((x) => [x._id, x.cuisine_name])))
      })
      .catch(() => {})
  }, [])

  const fetchPage = useCallback(
    async (page) => {
      const base = { limit: PAGE_SIZE, page, sort: 'for_you', ...(tag && { tags: tag }), ...(cuisine && { cuisine }) }
      if (lat === undefined) return { ...(await api.get('/restos', { params: base })).data, widened: false }
      const near = { ...base, lat, lng, radius: NEARBY_RADIUS_KM }
      const res = (await api.get('/restos', { params: near })).data
      if (res.total > 0 || page > 1) return { ...res, widened: false }
      // rien à côté : on élargit plutôt que d'afficher un fil vide
      return { ...(await api.get('/restos', { params: { ...base, lat, lng } })).data, widened: true }
    },
    [tag, cuisine, lat, lng],
  )

  // (re)charge la première page ; les réponses d'une requête périmée sont ignorées
  const load = useCallback(() => {
    const id = ++request.current
    setFeed((f) => ({ ...f, status: 'loading' }))
    fetchPage(1)
      .then((res) => id === request.current && setFeed({ status: 'ok', items: res.items, page: 1, pages: res.pages, widened: res.widened }))
      .catch(() => id === request.current && setFeed((f) => ({ ...f, status: 'error' })))
  }, [fetchPage])

  useEffect(() => {
    load()
  }, [load, prefsKey])

  const loadMore = async () => {
    const id = request.current
    setLoadingMore(true)
    try {
      const res = await fetchPage(feed.page + 1)
      if (id === request.current) setFeed((f) => ({ ...f, items: [...f.items, ...res.items], page: f.page + 1, pages: res.pages }))
    } catch {
      /* le bouton reste disponible pour réessayer */
    } finally {
      setLoadingMore(false)
    }
  }

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    next.delete('tag')
    next.delete('cuisine')
    if (value) next.set(key, value)
    setParams(next, { replace: true })
  }
  const filterLabel = tag ? `#${tag}` : cuisine

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
                  <RestoCard key={r._id} index={i % PAGE_SIZE} resto={r} cuisineNames={(r.cuisines || []).map((id) => cuisineNames[id]).filter(Boolean)} />
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