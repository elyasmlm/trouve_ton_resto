import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import ListSheet from '../components/ListSheet.jsx'
import { ListsContext } from './ListsContext.js'

const ORDER = { wishlist: 0, eatenlist: 1, custom: 2 }
const sortLists = (lists) => [...lists].sort((a, b) => ORDER[a.type] - ORDER[b.type])

// Les listes de l'utilisateur connecté, partagées par toute l'appli (cartes, panneau, pages)
export default function ListsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?._id
  const [state, setState] = useState({ status: 'idle', lists: [] })
  const [sheetResto, setSheetResto] = useState(null)

  useEffect(() => {
    if (!userId) {
      setState({ status: 'idle', lists: [] })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    api
      .get('/lists')
      .then((res) => !cancelled && setState({ status: 'ok', lists: res.data.items }))
      .catch(() => !cancelled && setState((s) => ({ ...s, status: 'error' })))
    return () => {
      cancelled = true
    }
  }, [userId])

  const replace = useCallback((list) => {
    setState((s) => {
      const exists = s.lists.some((l) => l._id === list._id)
      return { ...s, lists: sortLists(exists ? s.lists.map((l) => (l._id === list._id ? list : l)) : [...s.lists, list]) }
    })
  }, [])

  const create = useCallback(
    async (name) => {
      const list = (await api.post('/lists', { name })).data.list
      replace(list)
      return list
    },
    [replace],
  )

  // Crée une liste et y met directement un resto (une seule opération, sans dépendre de l'état affiché)
  const createWithResto = useCallback(
    async (name, restoId) => {
      const created = (await api.post('/lists', { name })).data.list
      replace(created)
      const filled = (await api.post(`/lists/${created._id}/restos`, { resto: restoId })).data.list
      replace(filled)
      return filled
    },
    [replace],
  )

  // Ajoute ou retire un resto ; l'interface réagit tout de suite, puis se cale sur la réponse du serveur
  const toggleResto = useCallback(
    async (listId, restoId) => {
      const before = state.lists.find((l) => l._id === listId)
      if (!before) return
      const has = before.restos.includes(restoId)
      const restos = has ? before.restos.filter((id) => id !== restoId) : [...before.restos, restoId]
      replace({ ...before, restos, count: restos.length })
      try {
        const res = has ? await api.delete(`/lists/${listId}/restos/${restoId}`) : await api.post(`/lists/${listId}/restos`, { resto: restoId })
        replace(res.data.list)
        return res.data.list
      } catch (err) {
        replace(before)
        throw err
      }
    },
    [state.lists, replace],
  )

  const update = useCallback(async (listId, data) => {
    const list = (await api.patch(`/lists/${listId}`, data)).data.list
    replace(list)
    return list
  }, [replace])

  const remove = useCallback(async (listId) => {
    await api.delete(`/lists/${listId}`)
    setState((s) => ({ ...s, lists: s.lists.filter((l) => l._id !== listId) }))
  }, [])

  const forget = useCallback((listId) => setState((s) => ({ ...s, lists: s.lists.filter((l) => l._id !== listId) })), [])

  const isSaved = useCallback((restoId) => state.lists.some((l) => l.restos.includes(restoId)), [state.lists])
  const openSheet = useCallback((resto) => setSheetResto(resto), [])

  const value = useMemo(
    () => ({ lists: state.lists, status: state.status, create, createWithResto, toggleResto, update, remove, forget, replace, isSaved, openSheet }),
    [state, create, createWithResto, toggleResto, update, remove, forget, replace, isSaved, openSheet],
  )

  return (
    <ListsContext.Provider value={value}>
      {children}
      {sheetResto && <ListSheet resto={sheetResto} onClose={() => setSheetResto(null)} />}
    </ListsContext.Provider>
  )
}