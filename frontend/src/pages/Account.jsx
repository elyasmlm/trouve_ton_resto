import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'

const ROLES = { user: 'Membre', premium: 'Membre premium', restaurateur: 'Restaurateur', admin: 'Admin' }

export default function Account() {
  const { user, logout, logoutEverywhere } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState('')

  const leaveEverywhere = async () => {
    if (!window.confirm('Te déconnecter de tous tes appareils ? Il faudra te reconnecter partout.')) return
    setError('')
    try {
      await logoutEverywhere()
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const leave = () => {
    navigate('/')
    logout()
  }

  return (
    <section className="fade-in wrap" style={{ maxWidth: 560 }}>
      <div className="profile">
        <div className="avatar" aria-hidden="true">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <h1 style={{ fontSize: '2rem' }}>{user.username}</h1>
        <p className="profile__mail">{user.mail}</p>
        <span className="tag">{ROLES[user.role] || 'Membre'}</span>
      </div>
      <div className="stats">
        <div className="stat">
          <strong>{user.level ?? 1}</strong>
          <span>Niveau</span>
        </div>
        <div className="stat">
          <strong>{user.exp_points ?? 0}</strong>
          <span>Points</span>
        </div>
        <div className="stat">
          <strong>{user.badges?.length ?? 0}</strong>
          <span>Badges</span>
        </div>
      </div>
      <Link to="/preferences" className="btn btn--primary btn--block" style={{ marginBottom: 12 }}>
        Modifier mes préférences
      </Link>
      {user.role === 'admin' && (
        <Link to="/admin" className="btn btn--secondary btn--block" style={{ marginBottom: 12 }}>
          Espace admin
        </Link>
      )}
      <button type="button" className="btn btn--secondary btn--block" onClick={leave}>
        Me déconnecter
      </button>
      <p className="side__hint" style={{ marginTop: 16, textAlign: 'center' }}>
        Tu restes connecté longtemps sur cet appareil. Un téléphone perdu ou un appareil partagé ?
      </p>
      <button type="button" className="btn btn--link btn--block" onClick={leaveEverywhere}>
        Me déconnecter de tous mes appareils
      </button>
      {error && (
        <p className="alert" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </section>
  )
}