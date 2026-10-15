import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import { REASONS } from '../utils/reports.js'

// Fenêtre « Signaler » : on choisit ce qui pose problème (la photo affichée ou le resto), le motif, et un détail facultatif
function ReportDialog({ resto, photo, onClose }) {
  const dialog = useRef(null)
  const [scope, setScope] = useState(photo ? 'photo' : 'resto')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [state, setState] = useState({ status: 'idle', error: '' })

  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'sending', error: '' })
    try {
      await api.post('/reports', {
        type: scope,
        target: scope === 'photo' ? photo._id : resto._id,
        reason,
        ...(details.trim() && { details: details.trim() }),
      })
      setState({ status: 'done', error: '' })
    } catch (err) {
      setState({ status: 'idle', error: errorMessage(err) })
    }
  }

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="report-title" onClose={onClose} onClick={(e) => e.target === dialog.current && dialog.current.close()}>
      <div className="sheet__inner">
        <div className="sheet__head">
          <div>
            <h2 id="report-title">Signaler</h2>
            <p>{resto.name}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => dialog.current.close()} aria-label="Fermer">
            ✕
          </button>
        </div>

        {state.status === 'done' ? (
          <>
            <p className="notice notice--soft" role="status">
              Merci, c’est noté. Un admin va regarder ça.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => dialog.current.close()}>
              Fermer
            </button>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            {photo && (
              <fieldset className="fieldset">
                <legend>Qu’est-ce qui pose problème ?</legend>
                <div className="manage">
                  <label className="switch">
                    <input type="radio" name="scope" checked={scope === 'photo'} onChange={() => setScope('photo')} />
                    <span>Cette photo</span>
                  </label>
                  <label className="switch">
                    <input type="radio" name="scope" checked={scope === 'resto'} onChange={() => setScope('resto')} />
                    <span>Ce resto</span>
                  </label>
                </div>
              </fieldset>
            )}
            <fieldset className="fieldset">
              <legend>Pourquoi ?</legend>
              <ul className="reasons">
                {REASONS.map(([value, label]) => (
                  <li key={value}>
                    <label className="switch">
                      <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} required />
                      <span>{label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="field">
              <label htmlFor="report-details">Un détail ? (facultatif)</label>
              <textarea id="report-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            {state.error && (
              <p className="alert" role="alert">
                {state.error}
              </p>
            )}
            <button className="btn btn--primary" disabled={!reason || state.status === 'sending'}>
              {state.status === 'sending' ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
}

export default function ReportButton({ resto, photo, className = 'report-link', children = 'Signaler' }) {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  if (!user) {
    return (
      <Link to="/connexion" state={{ from: location.pathname + location.search, notice: 'Connecte-toi pour signaler un contenu.' }} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <ReportDialog resto={resto} photo={photo} onClose={() => setOpen(false)} />}
    </>
  )
}