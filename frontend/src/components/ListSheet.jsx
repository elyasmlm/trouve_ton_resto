import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { useLists } from '../lists/useLists.js'
import { CheckCircleIcon, FolderIcon, ListIcon } from './Icons.jsx'

const ICONS = { wishlist: ListIcon, eatenlist: CheckCircleIcon, custom: FolderIcon }

// Fenêtre « Ajouter à une liste » : feuille en bas de l'écran sur mobile, fenêtre centrée sur ordinateur
export default function ListSheet({ resto, onClose }) {
  const { lists, status, toggleResto, createWithResto } = useLists()
  const dialog = useRef(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  }, [])

  const toggle = async (list) => {
    setError('')
    try {
      await toggleResto(list._id, resto._id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await createWithResto(name.trim(), resto._id)
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="sheet-title" onClose={onClose} onClick={(e) => e.target === dialog.current && dialog.current.close()}>
      <div className="sheet__inner">
        <div className="sheet__head">
          <div>
            <h2 id="sheet-title">Ajouter à une liste</h2>
            <p>{resto.name}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => dialog.current.close()} aria-label="Fermer">
            ✕
          </button>
        </div>

        {status === 'loading' && <p className="sheet__hint">Chargement de tes listes…</p>}
        {status === 'error' && <p className="alert">Impossible de charger tes listes.</p>}
        <ul className="sheet__lists">
          {lists.map((list) => {
            const Icon = ICONS[list.type]
            const saved = list.restos.includes(resto._id)
            return (
              <li key={list._id}>
                <button type="button" role="checkbox" aria-checked={saved} className="sheet__item" onClick={() => toggle(list)}>
                  <Icon />
                  <span className="sheet__name">
                    {list.name}
                    {!list.is_owner && <small> · de {list.owner.username}</small>}
                  </span>
                  <span className="sheet__count">{list.count}</span>
                  <span className="sheet__check" aria-hidden="true">
                    {saved ? '✓' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <form className="sheet__new" onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nouvelle liste (ex. Brunchs)" aria-label="Nom de la nouvelle liste" />
          <button className="btn btn--primary btn--small" disabled={busy || !name.trim()}>
            Créer
          </button>
        </form>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  )
}