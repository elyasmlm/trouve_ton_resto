import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import Loader from '../components/Loader.jsx'
import RestoCard from '../components/RestoCard.jsx'
import { useLists } from '../lists/useLists.js'

const TYPE_LABEL = { wishlist: 'Wishlist', eatenlist: 'Déjà testés', custom: 'Liste perso' }

export default function ListDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { replace, remove, forget, toggleResto } = useLists()
  const navigate = useNavigate()
  const [data, setData] = useState({ status: 'loading' })
  const [cuisineNames, setCuisineNames] = useState({})
  const [renaming, setRenaming] = useState(null)
  const [collab, setCollab] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setData({ status: 'loading' })
    Promise.all([api.get(`/lists/${id}`), api.get('/cuisines')])
      .then(([res, cuisines]) => {
        if (cancelled) return
        setData({ status: 'ok', list: res.data.list, restos: res.data.restos, canWrite: res.data.can_write })
        setCuisineNames(Object.fromEntries(cuisines.data.items.map((c) => [c._id, c.cuisine_name])))
      })
      .catch((err) => !cancelled && setData({ status: err.response?.status === 404 ? 'missing' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [id, user?._id])

  const apply = (list) => {
    setData((d) => ({ ...d, list }))
    replace(list)
  }
  const run = async (action) => {
    setMessage('')
    try {
      await action()
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  if (data.status === 'loading') return <Loader />
  if (data.status !== 'ok') {
    return (
      <section className="soon wrap fade-in">
        <span className="tag">{data.status === 'missing' ? 'Introuvable' : 'Erreur'}</span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>{data.status === 'missing' ? 'Cette liste n’existe pas' : 'Impossible de charger la liste'}</h1>
        <p>{data.status === 'missing' ? 'Elle a peut-être été supprimée, ou elle est privée.' : 'Réessaie dans un instant.'}</p>
        <Link to={user ? '/listes' : '/'} className="btn btn--primary">
          {user ? 'Retour à mes listes' : 'Retour à l’accueil'}
        </Link>
      </section>
    )
  }

  const { list, restos, canWrite } = data
  const custom = list.type === 'custom'
  const shareUrl = `${window.location.origin}/listes/${list._id}`

  const rename = (e) => {
    e.preventDefault()
    run(async () => {
      apply(await (await api.patch(`/lists/${list._id}`, { name: renaming })).data.list)
      setRenaming(null)
    })
  }
  const removeResto = (restoId) =>
    run(async () => {
      await toggleResto(list._id, restoId)
      setData((d) => ({ ...d, restos: d.restos.filter((r) => r._id !== restoId), list: { ...d.list, restos: d.list.restos.filter((x) => x !== restoId), count: d.list.count - 1 } }))
    })
  const del = () =>
    run(async () => {
      if (!window.confirm(`Supprimer la liste « ${list.name} » ?`)) return
      await remove(list._id)
      navigate('/listes')
    })
  const addCollab = (e) => {
    e.preventDefault()
    run(async () => {
      apply((await api.post(`/lists/${list._id}/collaborators`, { username: collab.trim() })).data.list)
      setCollab('')
    })
  }
  const dropCollab = (userId) => run(async () => apply((await api.delete(`/lists/${list._id}/collaborators/${userId}`)).data.list))
  const leave = () =>
    run(async () => {
      await api.delete(`/lists/${list._id}/collaborators/${user._id}`)
      forget(list._id)
      navigate('/listes')
    })
  const copy = () => run(async () => {
    await navigator.clipboard.writeText(shareUrl)
    setMessage('Lien copié !')
  })

  return (
    <section className="wrap fade-in">
      {user && (
        <Link to="/listes" className="back">
          ← Mes listes
        </Link>
      )}
      <div className="feed-head">
        <span className="eyebrow">{TYPE_LABEL[list.type]}</span>
        {renaming === null ? (
          <h1>{list.name}</h1>
        ) : (
          <form className="prefs__add" onSubmit={rename}>
            <input value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={40} aria-label="Nouveau nom" autoFocus />
            <button className="btn btn--primary btn--small">Enregistrer</button>
            <button type="button" className="btn btn--link" onClick={() => setRenaming(null)}>
              Annuler
            </button>
          </form>
        )}
        <p>
          {list.count} resto{list.count > 1 ? 's' : ''}
          {!list.is_owner && ` · par ${list.owner.username}`}
          {list.is_public && ' · publique'}
        </p>
      </div>

      {message && (
        <p className="notice notice--soft" role="status">
          {message}
        </p>
      )}

      {list.is_owner && (
        <div className="manage">
          <label className="switch">
            <input type="checkbox" checked={list.is_public} onChange={(e) => run(async () => apply((await api.patch(`/lists/${list._id}`, { is_public: e.target.checked })).data.list))} />
            <span>Liste publique (visible avec le lien)</span>
          </label>
          {list.is_public && (
            <button type="button" className="pill" onClick={copy}>
              Copier le lien
            </button>
          )}
          {custom && (
            <>
              <button type="button" className="pill" onClick={() => setRenaming(list.name)}>
                Renommer
              </button>
              <button type="button" className="pill" onClick={del}>
                Supprimer
              </button>
            </>
          )}
        </div>
      )}
      {!list.is_owner && canWrite && (
        <div className="manage">
          <button type="button" className="pill" onClick={leave}>
            Quitter cette liste
          </button>
        </div>
      )}

      {custom && list.is_owner && (
        <div className="card collab">
          <h2>Avec qui tu partages</h2>
          {list.collaborators.length > 0 ? (
            <ul className="pills">
              {list.collaborators.map((c) => (
                <li key={c._id}>
                  <button type="button" className="pill" onClick={() => dropCollab(c._id)} aria-label={`Retirer ${c.username}`}>
                    {c.username} ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="side__hint">Personne pour l’instant. Ajoute un pseudo pour construire la liste à plusieurs.</p>
          )}
          <form className="prefs__add" onSubmit={addCollab}>
            <input value={collab} onChange={(e) => setCollab(e.target.value)} maxLength={30} placeholder="Pseudo d’un ami" aria-label="Pseudo à ajouter" />
            <button className="btn btn--secondary btn--small" disabled={!collab.trim()}>
              Ajouter
            </button>
          </form>
        </div>
      )}

      {restos.length === 0 ? (
        <div className="state" style={{ marginTop: 22 }}>
          <h2>Cette liste est vide</h2>
          <p>Depuis le fil, appuie sur le bouton liste d’un resto pour l’ajouter ici.</p>
          <Link to="/" className="btn btn--primary">
            Voir le fil
          </Link>
        </div>
      ) : (
        <div className="feed" style={{ marginTop: 22 }}>
          {restos.map((r, i) => (
            <RestoCard
              key={r._id}
              index={i}
              resto={r}
              cuisineNames={(r.cuisines || []).map((cid) => cuisineNames[cid]).filter(Boolean)}
              extra={
                canWrite && (
                  <button type="button" className="btn btn--link" onClick={() => removeResto(r._id)}>
                    Retirer de la liste
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}