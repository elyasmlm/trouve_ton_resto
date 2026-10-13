import { useId, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { errorMessage } from '../api/errors.js'
import PasswordField from '../components/PasswordField.jsx'
import { LogoMark } from '../components/Icons.jsx'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nameId = useId()
  const mailId = useId()
  const [username, setUsername] = useState('')
  const [mail, setMail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = location.state?.from || '/'
  if (user) return <Navigate to={from} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(username.trim(), mail.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <section className="auth fade-in wrap">
      <div className="card">
        <LogoMark className="auth__mark" />
        <h1>Bienvenue à table</h1>
        <p className="auth__sub">Crée ton compte en 20 secondes.</p>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor={nameId}>Pseudo</label>
            <input
              id={nameId}
              autoComplete="username"
              autoCapitalize="none"
              minLength={3}
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={mailId}>Adresse mail</label>
            <input
              id={mailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              required
            />
          </div>
          <PasswordField
            autoComplete="new-password"
            hint="8 caractères minimum."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
      </div>
      <p className="auth__switch">
        Déjà inscrit ? <Link to="/connexion" state={{ from: location.state?.from }}>Connecte-toi</Link>
      </p>
    </section>
  )
}