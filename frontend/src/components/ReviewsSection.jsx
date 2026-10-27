import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import { fmt } from '../utils/resto.js'
import Loader from './Loader.jsx'
import ReportButton from './ReportButton.jsx'
import StarRating from './StarRating.jsx'

const date = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function Stars({ value }) {
  return (
    <span className="stars" style={{ '--pct': `${(value / 5) * 100}%` }} role="img" aria-label={`${fmt(value)} sur 5`}>
      ★★★★★
    </span>
  )
}

// Réponse du restaurateur sous un avis ; ceux qui peuvent répondre (propriétaire, admin) l'écrivent, la modifient ou la retirent
function Reply({ restoId, review, canReply, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.reply?.text || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = `/restos/${restoId}/reviews/${review._id}/reply`

  const run = async (call) => {
    setBusy(true)
    setError('')
    try {
      await call()
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <form
        className="review__reply"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => api.put(url, { text: text.trim() }))
        }}
      >
        <div className="field">
          <label htmlFor={`reply-${review._id}`}>Ta réponse (publique)</label>
          <textarea id={`reply-${review._id}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} required />
        </div>
        {error && <p className="alert">{error}</p>}
        <div className="myreview__actions">
          <button type="submit" className="btn btn--primary btn--small" disabled={busy || !text.trim()}>
            Publier la réponse
          </button>
          <button type="button" className="btn btn--link" onClick={() => setEditing(false)}>
            Annuler
          </button>
        </div>
      </form>
    )
  }

  if (!review.reply?.text) {
    return canReply ? (
      <button type="button" className="btn btn--secondary btn--small review__respond" onClick={() => { setText(''); setEditing(true) }}>
        Répondre
      </button>
    ) : null
  }

  return (
    <div className="review__reply">
      <div className="review__head">
        <b>Réponse du restaurant</b>
        <time dateTime={review.reply.date}>{date(review.reply.date)}</time>
      </div>
      <p>{review.reply.text}</p>
      {canReply && (
        <div className="myreview__actions">
          <button type="button" className="btn btn--link" onClick={() => { setText(review.reply.text); setEditing(true) }}>
            Modifier
          </button>
          <button type="button" className="btn btn--link" disabled={busy} onClick={() => window.confirm('Supprimer ta réponse ?') && run(() => api.delete(url))}>
            Supprimer
          </button>
        </div>
      )}
      {error && <p className="alert">{error}</p>}
    </div>
  )
}

// Formulaire pour écrire, modifier ou supprimer son propre avis
function MyReview({ restoId, mine, onSaved }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [editing, setEditing] = useState(!mine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = `/restos/${restoId}/reviews`

  const submit = async (e) => {
    e.preventDefault()
    if (!rating) return setError('Choisis une note en touchant les étoiles.')
    setBusy(true)
    setError('')
    try {
      const body = { rating, comment: comment.trim() }
      const res = mine ? await api.patch(`${url}/${mine._id}`, body) : await api.post(url, body)
      setEditing(false)
      onSaved(res.data.review)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Supprimer ton avis ?')) return
    setBusy(true)
    setError('')
    try {
      await api.delete(`${url}/${mine._id}`)
      setRating(0)
      setComment('')
      setEditing(true)
      onSaved(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (mine && !editing) {
    return (
      <div className="myreview">
        <b>Ton avis</b>
        <Stars value={mine.rating} />
        {mine.comment && <p>{mine.comment}</p>}
        <div className="myreview__actions">
          <button type="button" className="btn btn--secondary btn--small" onClick={() => setEditing(true)}>
            Modifier
          </button>
          <button type="button" className="btn btn--link" onClick={remove} disabled={busy}>
            Supprimer
          </button>
        </div>
        {error && <p className="alert">{error}</p>}
      </div>
    )
  }

  return (
    <form className="myreview" onSubmit={submit}>
      <b>{mine ? 'Modifier ton avis' : 'Donne ton avis'}</b>
      <StarRating value={rating} onChange={setRating} disabled={busy} />
      <div className="field">
        <label htmlFor="review-comment">Ton commentaire (facultatif)</label>
        <textarea id="review-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="myreview__actions">
        <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
          {mine ? 'Enregistrer' : 'Publier'}
        </button>
        {mine && (
          <button type="button" className="btn btn--link" onClick={() => setEditing(false)}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

// Avis des utilisateurs d'un resto + formulaire pour le connecté ; `onChange` prévient la page quand la note du site bouge
export default function ReviewsSection({ resto, onChange }) {
  const { user } = useAuth()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading', items: [], page: 1, pages: 1, total: 0 })
  const [mine, setMine] = useState(undefined)
  const isOwner = Boolean(user && (user.restos || []).includes(resto._id))
  const canReply = Boolean(user && (user.role === 'admin' || isOwner))
  const userId = user?._id

  const load = useCallback(
    async (page) => {
      try {
        const res = await api.get(`/restos/${resto._id}/reviews`, { params: { page } })
        setState((s) => ({ status: 'ok', items: page === 1 ? res.data.items : [...s.items, ...res.data.items], page, pages: res.data.pages, total: res.data.total }))
      } catch {
        setState((s) => ({ ...s, status: 'error' }))
      }
    },
    [resto._id],
  )

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    if (!userId) return setMine(undefined)
    let cancelled = false
    api
      .get(`/restos/${resto._id}/reviews/mine`)
      .then((res) => !cancelled && setMine(res.data.review))
      .catch(() => !cancelled && setMine(null))
    return () => {
      cancelled = true
    }
  }, [resto._id, userId])

  const saved = (review) => {
    setMine(review)
    load(1)
    onChange?.()
  }

  const { status, items, page, pages, total } = state
  return (
    <section className="detail__sec" aria-labelledby="avis">
      <h2 id="avis">Avis{total > 0 && ` (${total})`}</h2>

      {!user && (
        <p>
          <Link to="/connexion" state={{ from: location.pathname, notice: 'Connecte-toi pour donner ton avis.' }}>
            Connecte-toi
          </Link>{' '}
          pour donner ton avis.
        </p>
      )}
      {user && isOwner && <p className="detail__muted">Tu ne peux pas noter ton propre resto.</p>}
      {user && !isOwner && mine !== undefined && <MyReview key={mine?._id || 'new'} restoId={resto._id} mine={mine} onSaved={saved} />}

      {status === 'loading' && <Loader />}
      {status === 'error' && <p className="alert">Impossible de charger les avis.</p>}
      {status === 'ok' && items.length === 0 && <p className="detail__muted">Aucun avis pour le moment. Sois le premier !</p>}

      <ul className="reviews">
        {items.map((r) => (
          <li key={r._id} className="review">
            <div className="review__head">
              <b>{r.user?.username || 'Utilisateur supprimé'}</b>
              <Stars value={r.rating} />
              <time dateTime={r.date}>{date(r.date)}</time>
              {r.user?._id !== userId && <ReportButton resto={resto} review={r} className="report-link review__report" />}
            </div>
            {r.comment && <p>{r.comment}</p>}
            <Reply key={r.reply?.date || 'none'} restoId={resto._id} review={r} canReply={canReply} onChanged={() => load(1)} />
          </li>
        ))}
      </ul>
      {status === 'ok' && page < pages && (
        <button type="button" className="btn btn--secondary btn--small" onClick={() => load(page + 1)}>
          Voir plus d’avis
        </button>
      )}
    </section>
  )
}
