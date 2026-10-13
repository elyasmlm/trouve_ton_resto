import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { useGeolocation } from './useGeolocation.js'

const PAGE_SIZE = 8
export const NEARBY_RADIUS_KM = 25

// Toute la logique du fil « For You » (données, filtres, position, pagination), indépendante de l'affichage
export function useFeed() {
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
      const res = (await api.get('/restos', { params: { ...base, lat, lng, radius: NEARBY_RADIUS_KM } })).data
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

  const loadMore = useCallback(async () => {
    const id = request.current
    setLoadingMore(true)
    try {
      const res = await fetchPage(feed.page + 1)
      if (id === request.current) setFeed((f) => ({ ...f, items: [...f.items, ...res.items], page: f.page + 1, pages: res.pages }))
    } catch {
      /* on pourra réessayer au prochain défilement */
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, feed.page])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    next.delete('tag')
    next.delete('cuisine')
    if (value) next.set(key, value)
    setParams(next, { replace: true })
  }

  return { user, tag, cuisine, filterLabel: tag ? `#${tag}` : cuisine, setFilter, geo, trends, cuisineNames, feed, load, loadMore, loadingMore }
}