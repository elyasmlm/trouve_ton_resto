import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { NotificationsContext } from './NotificationsContext.js'

const POLL_MS = 60_000

// Le nombre de notifications non lues de l'utilisateur connecté (pastille de la cloche), rafraîchi toutes les minutes
export default function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?._id
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setUnread((await api.get('/notifications/unread-count')).data.unread)
    } catch {
      /* hors ligne ou session expirée : on garde le dernier nombre connu */
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setUnread(0)
      return
    }
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    const timer = setInterval(onVisible, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  const value = useMemo(() => ({ unread, setUnread, refresh }), [unread, refresh])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
