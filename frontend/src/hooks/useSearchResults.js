import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/client.js'
import { apiParams } from '../utils/searchParams.js'

const PAGE_SIZE = 12

// Résultats en liste : se recharge à chaque changement de filtre (réponses périmées ignorées), « voir plus » pour la suite
export function useSearchResults(filters, coords) {
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, page: 1, pages: 1 })
  const [loadingMore, setLoadingMore] = useState(false)
  const request = useRef(0)

  const fetchPage = useCallback((page) => api.get('/restos', { params: { ...apiParams(filters, coords), page, limit: PAGE_SIZE } }).then((r) => r.data), [filters, coords])

  const load = useCallback(() => {
    const id = ++request.current
    setState((s) => ({ ...s, status: 'loading' }))
    fetchPage(1)
      .then((res) => id === request.current && setState({ status: 'ok', items: res.items, total: res.total, page: 1, pages: res.pages }))
      .catch(() => id === request.current && setState((s) => ({ ...s, status: 'error' })))
  }, [fetchPage])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    const id = request.current
    setLoadingMore(true)
    try {
      const res = await fetchPage(state.page + 1)
      if (id === request.current) setState((s) => ({ ...s, items: [...s.items, ...res.items], page: s.page + 1, pages: res.pages, total: res.total }))
    } catch {
      /* le bouton reste disponible pour réessayer */
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, state.page])

  return { ...state, loadingMore, loadMore, reload: load }
}