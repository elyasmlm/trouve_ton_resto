import axios from 'axios'

export const TOKEN_KEY = 'ttr_token'

export const storage = {
  get: (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* stockage indisponible (navigation privée...) : on continue sans */
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* idem */
    }
  },
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token expiré ou invalide : on déconnecte (sauf pendant la connexion elle-même)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !isAuthCall && storage.get(TOKEN_KEY)) {
      storage.remove(TOKEN_KEY)
      window.dispatchEvent(new Event('ttr:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export default api