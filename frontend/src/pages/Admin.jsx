import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import Loader from '../components/Loader.jsx'
import { REASON_LABEL, TYPE_LABEL } from '../utils/reports.js'

const REFUSAL_PRESETS = ['Adresse introuvable', 'Doublon d’un resto déjà présent', 'Ce n’est pas un restaurant', 'Informations insuffisantes', 'Contenu inapproprié']
const date = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

function Empty({ children }) {
  return (
    <div className="state">
      <p>{children}</p>
    </div>
  )
}

// ---------- fiches de restos ----------
function RestoCard({ resto: r, refused, onDone }) {
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const act = async (path, body) => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/admin/restos/${r._id}/${path}`, body)
      onDone(r._id)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const address = [r.location.street, [r.location.zip, r.location.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return (
    <article className="mod">
      <header>
        <h3>{r.name}</h3>
        <span className="tag">{date(r.created_at)}</span>
      </header>
      <p className="mod__line">{address}</p>
      <p className="mod__line mod__meta">
        par <b>{r.added_by?.username || 'inconnu'}</b>
        {r.cuisines?.length > 0 && ` · ${r.cuisines.map((c) => c.cuisine_name).join(', ')}`}
        {r.price_range && ` · ${r.price_range}`}
      </p>
      <p className="mod__line mod__meta">
        {[r.halal_certificate && 'Halal', r.vegan && 'Option végé', r.phone_numbers?.[0], r.website, r.geo ? 'Position GPS' : 'Sans position GPS'].filter(Boolean).join(' · ')}
      </p>
      {r.tags?.length > 0 && <p className="mod__line mod__meta">{r.tags.map((t) => `#${t}`).join(' ')}</p>}
      {r.photos?.length > 0 && (
        <ul className="mod__photos">
          {r.photos.map((p) => (
            <li key={p._id}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.thumb || p.url} alt="" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {refused && r.rejection_reason && <p className="alert">Refusé : {r.rejection_reason}</p>}

      {refusing ? (
        <form
          className="mod__refuse"
          onSubmit={(e) => {
            e.preventDefault()
            act('reject', { reason })
          }}
        >
          <ul className="pills">
            {REFUSAL_PRESETS.map((p) => (
              <li key={p}>
                <button type="button" className="pill" aria-pressed={reason === p} onClick={() => setReason(p)}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motif du refus" aria-label="Motif du refus" required minLength={3} />
          <div className="mod__actions">
            <button className="btn btn--primary btn--small" disabled={busy || reason.trim().length < 3}>
              Confirmer le refus
            </button>
            <button type="button" className="btn btn--link" onClick={() => setRefusing(false)}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mod__actions">
          {refused ? (
            <button type="button" className="btn btn--secondary btn--small" disabled={busy} onClick={() => act('restore')}>
              Remettre dans la file
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => act('verify')}>
                Valider
              </button>
              <button type="button" className="btn btn--secondary btn--small" disabled={busy} onClick={() => setRefusing(true)}>
                Refuser…
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

function RestoQueue({ filter, onChange }) {
  const [state, setState] = useState({ status: 'loading', items: [], total: 0 })

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    api
      .get('/admin/restos', { params: { filter, limit: 20 } })
      .then((res) => setState({ status: 'ok', items: res.data.items, total: res.data.total }))
      .catch(() => setState((s) => ({ ...s, status: 'error' })))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const done = (id) => {
    setState((s) => ({ ...s, items: s.items.filter((r) => r._id !== id), total: s.total - 1 }))
    onChange()
  }

  if (state.status === 'loading' && !state.items.length) return <Loader />
  if (state.status === 'error')
    return (
      <div className="state">
        <p>Impossible de charger la liste.</p>
        <button type="button" className="btn btn--primary" onClick={load}>
          Réessayer
        </button>
      </div>
    )
  if (!state.items.length) return <Empty>{filter === 'rejected' ? 'Aucune fiche refusée.' : 'Rien à vérifier : tout est à jour.'}</Empty>
  return (
    <div className="mod__list">
      {state.items.map((r) => (
        <RestoCard key={r._id} resto={r} refused={filter === 'rejected'} onDone={done} />
      ))}
      {state.total > state.items.length && <p className="side__hint">Il en reste {state.total - state.items.length} après celles-ci.</p>}
    </div>
  )
}

// ---------- signalements ----------
function ReportItem({ item, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const c = item.content

  const resolve = async (action) => {
    if (action === 'remove' && !window.confirm('Supprimer ce contenu ? Cette action est définitive.')) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/admin/reports/${item.id}/resolve`, { action })
      onDone(item.id)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <article className="mod">
      <header>
        <h3>
          {TYPE_LABEL[item.type]} · {item.resto?.name || 'resto supprimé'}
        </h3>
        <span className="tag">
          {item.count} signalement{item.count > 1 ? 's' : ''}
        </span>
      </header>
      <p className="mod__line mod__meta">{item.reasons.map((r) => REASON_LABEL[r] || r).join(' · ')}</p>
      {item.type === 'photo' && c && (
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="mod__preview">
          <img src={c.thumb || c.url} alt="Photo signalée" />
        </a>
      )}
      {item.type === 'review' && c && (
        <blockquote className="mod__quote">
          {'★'.repeat(Math.round(c.rating))} {c.comment || <i>(sans commentaire)</i>}
        </blockquote>
      )}
      {item.type === 'resto' && c && (
        <p className="mod__line">
          {c.name}, {c.location?.city} {c.status === 'rejected' && <b>(déjà refusé)</b>}
        </p>
      )}
      {!c && <p className="side__hint">Ce contenu a déjà été supprimé.</p>}
      {item.details.map((d, i) => (
        <blockquote key={i} className="mod__quote">
          {d}
        </blockquote>
      ))}
      <p className="mod__line mod__meta">Signalé par {item.reporters.join(', ')}</p>
      <div className="mod__actions">
        {c && (
          <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => resolve('remove')}>
            {item.type === 'resto' ? 'Refuser la fiche' : 'Supprimer'}
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--small" disabled={busy} onClick={() => resolve('dismiss')}>
          {c ? 'Ignorer' : 'Classer'}
        </button>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

function ReportQueue({ onChange }) {
  const [state, setState] = useState({ status: 'loading', items: [] })

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    api
      .get('/admin/reports')
      .then((res) => setState({ status: 'ok', items: res.data.items }))
      .catch(() => setState((s) => ({ ...s, status: 'error' })))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const done = (id) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
    onChange()
  }

  if (state.status === 'loading' && !state.items.length) return <Loader />
  if (state.status === 'error')
    return (
      <div className="state">
        <p>Impossible de charger les signalements.</p>
        <button type="button" className="btn btn--primary" onClick={load}>
          Réessayer
        </button>
      </div>
    )
  if (!state.items.length) return <Empty>Aucun signalement en attente.</Empty>
  return (
    <div className="mod__list">
      {state.items.map((item) => (
        <ReportItem key={item.id} item={item} onDone={done} />
      ))}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [stats, setStats] = useState({ pending: 0, reports: 0 })
  const isAdmin = user?.role === 'admin'

  const refreshStats = useCallback(() => {
    api.get('/admin/stats').then((res) => setStats(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (isAdmin) refreshStats()
  }, [isAdmin, refreshStats])

  if (!isAdmin) {
    return (
      <section className="soon wrap fade-in">
        <span className="tag">Accès réservé</span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>Cet espace est réservé aux admins</h1>
        <p>Si tu devrais y avoir accès, demande à un admin de te nommer.</p>
        <Link to="/" className="btn btn--primary">
          Retour à l’accueil
        </Link>
      </section>
    )
  }

  const tabs = [
    ['pending', 'À vérifier', stats.pending],
    ['reports', 'Signalements', stats.reports],
    ['rejected', 'Refusées', null],
  ]
  return (
    <section className="wrap admin fade-in">
      <span className="eyebrow">Modération</span>
      <h1>Espace admin</h1>
      <div className="admin__tabs" role="tablist">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
            {count > 0 && <b className="admin__badge">{count}</b>}
          </button>
        ))}
      </div>
      {tab === 'reports' ? <ReportQueue key="reports" onChange={refreshStats} /> : <RestoQueue key={tab} filter={tab} onChange={refreshStats} />}
    </section>
  )
}
