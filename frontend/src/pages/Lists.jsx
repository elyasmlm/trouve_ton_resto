import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { CheckCircleIcon, FolderIcon, ListIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import { useLists } from '../lists/useLists.js'

const ICONS = { wishlist: ListIcon, eatenlist: CheckCircleIcon, custom: FolderIcon }
const plural = (n) => `${n} resto${n > 1 ? 's' : ''}`

export default function Lists() {
  const { lists, status, create } = useLists()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const list = await create(name.trim())
      navigate(`/listes/${list._id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <section className="wrap fade-in">
      <div className="feed-head">
        <span className="eyebrow">Tes envies</span>
        <h1>Mes listes</h1>
        <p>Garde tes envies, retrouve tes restos testés et partage tes bonnes adresses.</p>
      </div>

      {status === 'loading' && lists.length === 0 && <Loader />}
      {status === 'error' && <p className="alert">Impossible de charger tes listes. Réessaie dans un instant.</p>}

      <ul className="list-grid">
        {lists.map((list) => {
          const Icon = ICONS[list.type]
          return (
            <li key={list._id}>
              <Link to={`/listes/${list._id}`} className="list-card">
                <span className="list-card__icon">
                  <Icon />
                </span>
                <span className="list-card__body">
                  <strong>{list.name}</strong>
                  <span>{plural(list.count)}</span>
                </span>
                <span className="list-card__tags">
                  {!list.is_owner && <span className="tag">Partagée</span>}
                  {list.is_owner && list.collaborators.length > 0 && <span className="tag">Avec {list.collaborators.length}</span>}
                  {list.is_public && <span className="tag">Publique</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <form className="card list-new" onSubmit={submit}>
        <h2>Nouvelle liste</h2>
        <div className="prefs__add">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. Brunchs du dimanche" aria-label="Nom de la liste" required />
          <button className="btn btn--primary btn--small" disabled={busy || !name.trim()}>
            Créer
          </button>
        </div>
        {error && (
          <p className="alert" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </form>
    </section>
  )
}