import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { useAuth } from '../auth/useAuth.js'
import { Field } from '../components/FormField.jsx'
import HoursEditor from '../components/HoursEditor.jsx'
import Loader from '../components/Loader.jsx'
import RestoFields from '../components/RestoFields.jsx'
import { canEditResto } from '../utils/resto.js'
import { WEEK, asUrl, locate, tagList } from '../utils/restoForm.js'
import NotFound from './NotFound.jsx'

const emptyWeek = () => Object.fromEntries(WEEK.map(([key]) => [key, []]))
const cleanWeek = (weekly = {}) => Object.fromEntries(WEEK.map(([key]) => [key, (weekly[key] || []).map((s) => ({ open: s.open, close: s.close }))]))

function toForm(r) {
  const social = r.social_networks || {}
  return {
    name: r.name,
    street: r.location.street,
    zip: r.location.zip,
    city: r.location.city,
    state: r.location.state,
    country: r.location.country || 'FR',
    cuisines: (r.cuisines || []).map((c) => c._id),
    price: r.price_range || '',
    meals: r.meal_types || [],
    vegan: Boolean(r.vegan),
    halal: Boolean(r.halal_certificate),
    phone: r.phone_numbers?.[0] || '',
    website: r.website || '',
    description: r.description || '',
    instagram: social.instagram || '',
    facebook: social.facebook || '',
    tags: (r.tags || []).join(', '),
  }
}

// Page de modification d'une fiche, réservée aux admins, aux propriétaires et à l'auteur d'une fiche non vérifiée
export default function EditResto() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', resto: null })
  const [form, setForm] = useState(null)
  const [cuisines, setCuisines] = useState([])
  const [week, setWeek] = useState(emptyWeek())
  const [hoursDirty, setHoursDirty] = useState(false)
  const [dietError, setDietError] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get(`/restos/${id}`), api.get('/cuisines').catch(() => ({ data: { items: [] } }))])
      .then(([res, cu]) => {
        if (cancelled) return
        const r = res.data.resto
        setForm(toForm(r))
        setWeek({ ...emptyWeek(), ...cleanWeek(r.open_hours?.weekly) })
        setCuisines(cu.data.items)
        setState({ status: 'ok', resto: r })
      })
      .catch((err) => !cancelled && setState({ status: err.response?.status === 404 ? 'missing' : 'error', resto: null }))
    return () => {
      cancelled = true
    }
  }, [id])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
    if (key === 'vegan' || key === 'halal') setDietError(false)
  }

  const { status, resto: r } = state
  if (status === 'loading') return <Loader />
  if (status === 'missing') return <NotFound />
  if (status === 'error') return <p className="alert wrap">Impossible de charger ce resto. Réessaie dans un instant.</p>
  if (!canEditResto(user, r)) {
    return (
      <section className="wrap fade-in detail">
        <h1>Modifier la fiche</h1>
        <p className="alert">Seuls les admins, les propriétaires du resto et l’auteur d’une fiche non vérifiée peuvent la modifier.</p>
        <Link to={`/restos/${r._id}`} className="btn btn--secondary">Retour à la fiche</Link>
      </section>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.halal && !form.vegan) {
      setDietError(true)
      document.getElementById('diet')?.scrollIntoView({ block: 'center' })
      return
    }
    setBusy(true)
    setError('')
    try {
      const social = Object.fromEntries(
        Object.entries({ ...(r.social_networks || {}), instagram: asUrl(form.instagram), facebook: asUrl(form.facebook) }).filter(([, v]) => v),
      )
      const body = {
        name: form.name.trim(),
        location: { street: form.street.trim(), zip: form.zip.trim(), city: form.city.trim(), state: form.state.trim(), country: form.country },
        cuisines: form.cuisines,
        meal_types: form.meals,
        price_range: form.price,
        vegan: form.vegan,
        halal_certificate: form.halal,
        phone_numbers: [form.phone.trim(), ...(r.phone_numbers || []).slice(1)].filter(Boolean),
        website: form.website.trim() && (/^https?:\/\//i.test(form.website.trim()) ? form.website.trim() : `https://${form.website.trim()}`),
        social_networks: social,
        description: form.description.trim(),
        tags: tagList(form.tags),
      }
      const moved = ['street', 'zip', 'city'].some((k) => form[k].trim() !== r.location[k])
      if (moved) {
        const geo = await locate(api, form)
        if (geo) body.geo = geo
      }
      await api.patch(`/restos/${r._id}`, body)
      if (hoursDirty) {
        await api.put(`/restos/${r._id}/open-hours`, { timezone: r.open_hours?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris', weekly: week })
      }
      navigate(`/restos/${r._id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <section className="wrap fade-in">
      <div className="feed-head">
        <span className="eyebrow">Fiche resto</span>
        <h1>Modifier {r.name}</h1>
        {r.verified && <p>Cette fiche est vérifiée : tes modifications sont publiées tout de suite.</p>}
      </div>
      <form className="form" onSubmit={submit}>
        <Field label="Nom du resto">{(fid) => <input id={fid} value={form.name} onChange={set('name')} required maxLength={120} autoComplete="off" />}</Field>

        <RestoFields form={form} set={set} setForm={setForm} cuisines={cuisines} dietError={dietError} />

        <fieldset className="fieldset">
          <legend>Horaires</legend>
          <HoursEditor
            value={week}
            onChange={(w) => {
              setWeek(w)
              setHoursDirty(true)
            }}
          />
        </fieldset>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="prefs__actions">
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <Link to={`/restos/${r._id}`} className="btn btn--link">
            Annuler
          </Link>
        </div>
      </form>
    </section>
  )
}
