import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import Loader from '../components/Loader.jsx'

// Les pages réservées aux membres renvoient vers la connexion (les invités ont une navigation réduite)
export default function RequireAuth({ children }) {
  const { user, loading, justLoggedOut } = useAuth()
  const location = useLocation()

  if (loading) return <Loader />
  if (!user && justLoggedOut) return <Navigate to="/" replace />
  if (!user) {
    return (
      <Navigate
        to="/connexion"
        replace
        state={{ from: location.pathname, notice: 'Connecte-toi pour accéder à cette page.' }}
      />
    )
  }
  return children
}