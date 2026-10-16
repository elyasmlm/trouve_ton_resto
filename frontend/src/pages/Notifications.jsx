import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { BellIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import { useNotifications } from '../notifications/useNotifications.js'

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
function ago(date) {
  const seconds = Math.round((new Date(date) - Date.now()) / 1000)
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'à l’instant'
}

// Où mène une notification (les fiches resto n'ont pas encore de page dédiée)
const target = (n) => (n.data?.list ? `/listes/${n.data.list}` : null)

export default function Notifications() {
  const { setUnread, refresh } = useNotifications()
  const [state, setState] = useState({ status: 'loading', items: [], page: 1, pages: 1 })
  const [error, setError] = useState('')

  const load = useCallback(
    async (page) => {
      try {
        const res = await api.get('/notifications', { params: { page } })
        setUnread(res.data.unread)
        setState((s) => ({ status: 'ok', items: page === 1 ? res.data.items : [...s.items, ...res.data.items], page, pages: res.data.pages }))
      } catch (err) {
        setError(errorMessage(err))
        setState((s) => ({ ...s, status: s.items.length ? 'ok' : 'error' }))
      }
    },
    [setUnread],
  )

  useEffect(() => {
    load(1)
  }, [load])

  const markRead = async (n) => {
    if (n.read) return
    setState((s) => ({ ...s, items: s.items.map((i) => (i._id === n._id ? { ...i, read: true } : i)) }))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await api.post(`/notifications/${n._id}/read`)
    } catch {
      refresh()
    }
  }

  const markAll = async () => {
    setError('')
    try {
      await api.post('/notifications/read-all')
      setState((s) => ({ ...s, items: s.items.map((i) => ({ ...i, read: true })) }))
      setUnread(0)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const remove = async (n) => {
    setError('')
    try {
      await api.delete(`/notifications/${n._id}`)
      setState((s) => ({ ...s, items: s.items.filter((i) => i._id !== n._id) }))
      if (!n.read) setUnread((u) => Math.max(0, u - 1))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const { status, items, page, pages } = state
  const hasUnread = items.some((n) => !n.read)

  return (
    <section className="wrap fade-in">
      <div className="feed-head">
        <span className="eyebrow">Ce qui bouge</span>
        <h1>Notifications</h1>
        {hasUnread && (
          <button type="button" className="btn btn--secondary btn--small" onClick={markAll}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      {error && <p className="alert">{error}</p>}
      {status === 'loading' && <Loader />}
      {status === 'error' && <p className="alert">Impossible de charger tes notifications. Réessaie dans un instant.</p>}
      {status === 'ok' && items.length === 0 && (
        <div className="notifs__empty">
          <BellIcon />
          <p>Rien pour le moment. Tu seras prévenu ici d’une invitation à une liste, d’un avis sur ta fiche ou d’une décision de modération.</p>
        </div>
      )}

      <ul className="notifs">
        {items.map((n) => {
          const to = target(n)
          const body = (
            <>
              <span className="notifs__msg">{n.message}</span>
              <time className="notifs__time" dateTime={n.created_at}>
                {ago(n.created_at)}
              </time>
            </>
          )
          return (
            <li key={n._id} className={`notifs__item${n.read ? '' : ' notifs__item--new'}`}>
              {to ? (
                <Link to={to} className="notifs__main" onClick={() => markRead(n)}>
                  {body}
                </Link>
              ) : (
                <button type="button" className="notifs__main" onClick={() => markRead(n)}>
                  {body}
                </button>
              )}
              <button type="button" className="notifs__del" aria-label="Supprimer cette notification" onClick={() => remove(n)}>
                ×
              </button>
            </li>
          )
        })}
      </ul>

      {status === 'ok' && page < pages && (
        <button type="button" className="btn btn--secondary" onClick={() => load(page + 1)}>
          Voir plus
        </button>
      )}
    </section>
  )
}
