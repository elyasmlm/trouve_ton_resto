import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { TOKEN_KEY, storage } from '../api/client.js'
import { AuthContext } from './AuthContext.js'

const GUEST_KEY = 'ttr_guest'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(storage.get(TOKEN_KEY)))
  const [guest, setGuest] = useState(() => storage.get(GUEST_KEY) === '1')
  // vrai juste après une déconnexion volontaire (pour renvoyer vers l'accueil, pas vers la connexion)
  const [justLoggedOut, setJustLoggedOut] = useState(false)

  // Au chargement : si on a un token, on récupère le profil
  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) return
    let cancelled = false
    api
      .get('/users/me')
      .then((res) => !cancelled && setUser(res.data.user))
      .catch(() => !cancelled && storage.remove(TOKEN_KEY))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('ttr:unauthorized', onUnauthorized)
    return () => window.removeEventListener('ttr:unauthorized', onUnauthorized)
  }, [])

  const startSession = useCallback((data) => {
    storage.set(TOKEN_KEY, data.token)
    storage.remove(GUEST_KEY)
    setGuest(false)
    setUser(data.user)
  }, [])

  const login = useCallback(
    async (mail, password) => startSession((await api.post('/auth/login', { mail, password })).data),
    [startSession],
  )

  const register = useCallback(
    async (username, mail, password) =>
      startSession((await api.post('/auth/register', { username, mail, password })).data),
    [startSession],
  )

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY)
    setUser(null)
    setJustLoggedOut(true)
    setTimeout(() => setJustLoggedOut(false), 1000)
  }, [])

  const continueAsGuest = useCallback(() => {
    storage.set(GUEST_KEY, '1')
    setGuest(true)
  }, [])

  const value = useMemo(
    () => ({ user, loading, guest, justLoggedOut, login, register, logout, continueAsGuest }),
    [user, loading, guest, justLoggedOut, login, register, logout, continueAsGuest],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}