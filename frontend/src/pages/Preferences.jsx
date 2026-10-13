import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import Loader from '../components/Loader.jsx'

const BUDGETS = [
  { value: '€', label: '€', hint: 'Petit prix' },
  { value: '€€', label: '€€', hint: 'Abordable' },
  { value: '€€€', label: '€€€', hint: 'On se fait plaisir' },
  { value: '€€€€', label: '€€€€', hint: 'Grande occasion' },
]

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

export default function Preferences() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const saved = user.preferences || {}
  const [cuisines, setCuisines] = useState([])
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState({ cuisines: saved.cuisines || [], prices: saved.price_ranges || [], tags: saved.tags || [] })
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/cuisines'), api.get('/trends')])
      .then(([c, t]) => {
        setCuisines(c.data.items)
        setTagSuggestions(t.data.tags.map((x) => x.tag))
      })
      .catch(() => setError('Impossible de charger les choix. Réessaie dans un instant.'))
      .finally(() => setLoading(false))
  }, [])

  const addCustom = (e) => {
    e.preventDefault()
    const tag = custom.trim().toLowerCase().replace(/^#/, '').slice(0, 30)
    if (tag && !picked.tags.includes(tag) && picked.tags.length < 20) setPicked((p) => ({ ...p, tags: [...p.tags, tag] }))
    setCustom('')
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.put('/users/me/preferences', { cuisines: picked.cuisines, price_ranges: picked.prices, tags: picked.tags })
      updateUser(res.data.user)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  const allTags = [...new Set([...picked.tags, ...tagSuggestions])]
  const count = picked.cuisines.length + picked.prices.length + picked.tags.length

  return (
    <section className="wrap prefs fade-in">
      <span className="eyebrow">Tes goûts</span>
      <h1>Dis-nous ce que tu aimes</h1>
      <p className="auth__sub">On s’en sert pour te montrer d’abord les restos qui te ressemblent. Tu peux tout changer plus tard.</p>

      <div className="prefs__block">
        <h2>Cuisines</h2>
        <ul className="pills">
          {cuisines.map((c) => (
            <li key={c._id}>
              <button type="button" className="pill" aria-pressed={picked.cuisines.includes(c._id)} onClick={() => setPicked((p) => ({ ...p, cuisines: toggle(p.cuisines, c._id) }))}>
                {c.cuisine_name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="prefs__block">
        <h2>Budget</h2>
        <ul className="pills">
          {BUDGETS.map((b) => (
            <li key={b.value}>
              <button type="button" className="pill pill--budget" aria-pressed={picked.prices.includes(b.value)} onClick={() => setPicked((p) => ({ ...p, prices: toggle(p.prices, b.value) }))}>
                <b>{b.label}</b> <span>{b.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="prefs__block">
        <h2>Tes envies</h2>
        <ul className="pills">
          {allTags.map((t) => (
            <li key={t}>
              <button type="button" className="pill pill--tag" aria-pressed={picked.tags.includes(t)} onClick={() => setPicked((p) => ({ ...p, tags: toggle(p.tags, t) }))}>
                #{t}
              </button>
            </li>
          ))}
        </ul>
        <form className="prefs__add" onSubmit={addCustom}>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={30} placeholder="Ajouter une envie (ex. brunch)" aria-label="Ajouter une envie" />
          <button className="btn btn--secondary btn--small">Ajouter</button>
        </form>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="prefs__actions">
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? 'Enregistrement…' : count ? `C’est bon (${count})` : 'Passer sans choisir'}
        </button>
        <button type="button" className="btn btn--link" onClick={() => navigate('/')}>
          Ignorer pour l’instant
        </button>
      </div>
    </section>
  )
}