import { useId, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { errorMessage } from '../api/errors.js'
import PasswordField from '../components/PasswordField.jsx'
import { LogoMark } from '../components/Icons.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mailId = useId()
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
      await login(mail, password)
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
        <h1>Content de te revoir</h1>
        <p className="auth__sub">Connecte-toi pour retrouver tes listes et tes favoris.</p>
        {location.state?.notice && <p className="notice">{location.state.notice}</p>}
        <form className="form" onSubmit={submit}>
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
          <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Connexion…' : 'Me connecter'}
          </button>
        </form>
      </div>
      <p className="auth__switch">
        Pas encore de compte ? <Link to="/inscription" state={{ from: location.state?.from }}>Inscris-toi</Link>
      </p>
    </section>
  )
}