import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { errorMessage } from '../api/errors.js'
import { CheckCircleIcon, MapPinIcon } from '../components/Icons.jsx'
import PhotoPicker from '../components/PhotoPicker.jsx'
import PlaceCredits from '../components/PlaceCredits.jsx'
import PlaceSearch from '../components/PlaceSearch.jsx'

const EMPTY = { name: '', street: '', zip: '', city: '', state: '', country: 'FR', cuisines: [], price: '', meals: [], vegan: false, halal: false, phone: '', website: '', instagram: '', facebook: '', tags: '' }

const COUNTRIES = [['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['LU', 'Luxembourg'], ['CA', 'Canada'], ['MA', 'Maroc'], ['DZ', 'Algérie'], ['TN', 'Tunisie'], ['ES', 'Espagne'], ['IT', 'Italie'], ['PT', 'Portugal'], ['DE', 'Allemagne'], ['GB', 'Royaume-Uni']]
const MEALS = [['breakfast', 'Petit-déj'], ['brunch', 'Brunch'], ['lunch', 'Déjeuner'], ['dinner', 'Dîner'], ['snack', 'Snack'], ['late_night', 'Tard le soir']]
const PRICES = [['€', 'Petit prix'], ['€€', 'Abordable'], ['€€€', 'On se fait plaisir'], ['€€€€', 'Grande occasion']]

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

const WEEK = [['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche']]
const showSlots = (slots = []) =>
  !slots.length ? 'Fermé' : slots.map((s) => (s.open === s.close ? '24 h/24' : `${s.open}–${s.close}`)).join(' · ')

// « instagram.com/monresto » -> « https://instagram.com/monresto » ; ce qui n'est pas un lien valide est ignoré
function asUrl(value) {
  const v = value.trim()
  if (!v) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return url.hostname.includes('.') ? url.toString() : undefined
  } catch {
    return undefined
  }
}

// Les adresses saisies à la main n'ont pas de coordonnées : on essaie de les retrouver (sans bloquer si ça échoue)
async function locate(form) {
  try {
    const q = `${form.street}, ${form.zip} ${form.city}`
    const res = await api.get('/places/search', { params: { q } })
    const hit = res.data.items[0]
    return hit ? { lat: hit.lat, lng: hit.lng } : null
  } catch {
    return null
  }
}

function Field({ label, children, hint }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

export default function AddResto() {
  const [phase, setPhase] = useState('search') // search | form | photos | done
  const [form, setForm] = useState(EMPTY)
  const [position, setPosition] = useState(null)
  const [prefill, setPrefill] = useState(null) // { sources, filled } : ce que la recherche a rempli
  const [hours, setHours] = useState(null) // { timezone, weekly } trouvés pour ce lieu
  const [useHours, setUseHours] = useState(true)
  const [pendingCuisines, setPendingCuisines] = useState([]) // noms de cuisines en attente du chargement de la liste
  const [note, setNote] = useState('')
  const [dietError, setDietError] = useState(false)
  const [photos, setPhotos] = useState([])
  const [cuisines, setCuisines] = useState([])
  const [dupes, setDupes] = useState([])
  const [dismissed, setDismissed] = useState(false)
  const [target, setTarget] = useState(null) // resto existant ou tout juste créé
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
    if (key === 'vegan' || key === 'halal') setDietError(false)
  }

  useEffect(() => {
    api.get('/cuisines').then((res) => setCuisines(res.data.items)).catch(() => {})
  }, [])

  // cuisines trouvées par la recherche (noms) -> cuisines cochées (identifiants)
  useEffect(() => {
    if (!pendingCuisines.length || !cuisines.length) return
    const ids = cuisines.filter((c) => pendingCuisines.includes(c.cuisine_name)).map((c) => c._id)
    setForm((f) => ({ ...f, cuisines: [...new Set([...f.cuisines, ...ids])] }))
    setPendingCuisines([])
  }, [pendingCuisines, cuisines])

  // « ce resto existe peut-être déjà » : même nom dans la même ville
  const name = form.name.trim()
  const city = form.city.trim()
  useEffect(() => {
    if (phase !== 'form' || name.length < 3 || city.length < 2) {
      setDupes([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .get('/restos', { params: { q: name, city, limit: 3 } })
        .then((res) => !cancelled && setDupes(res.data.items))
        .catch(() => !cancelled && setDupes([]))
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phase, name, city])

  const pick = (place) => {
    const social = place.socials || {}
    const filled = [
      place.phone && 'téléphone',
      place.website && 'site web',
      (social.instagram || social.facebook) && 'réseaux sociaux',
      place.hours?.timezone && 'horaires',
      place.cuisines?.length && 'cuisine',
      place.tags?.length && 'mots-clés',
    ].filter(Boolean)
    setForm({
      ...EMPTY,
      name: place.name,
      street: place.street,
      zip: place.zip,
      city: place.city,
      state: place.state,
      country: place.country || 'FR',
      phone: place.phone || '',
      website: place.website || '',
      instagram: social.instagram || '',
      facebook: social.facebook || '',
      tags: (place.tags || []).join(', '),
      vegan: Boolean(place.vegan),
      halal: Boolean(place.halal),
    })
    setPendingCuisines(place.cuisines || [])
    setPosition({ lat: place.lat, lng: place.lng })
    setHours(place.hours?.timezone ? { timezone: place.hours.timezone, weekly: place.hours.weekly } : null)
    setUseHours(true)
    setPrefill({ sources: place.sources || [], filled })
    setPhase('form')
  }

  const uploadPhotos = async (resto) => {
    if (!photos.length) return
    const data = new FormData()
    photos.forEach((p) => data.append('files', p.file, p.file.name))
    setProgress(0)
    await api.post(`/restos/${resto._id}/photos`, data, { onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded * 100) / e.total)) })
  }

  const submit = async (e) => {
    e.preventDefault()
    // règle de l'appli : un resto est halal, ou propose au moins une option végé
    if (!target && !form.halal && !form.vegan) {
      setDietError(true)
      document.getElementById('diet')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    setError('')
    let resto = target
    let created = false
    try {
      if (!resto) {
        const geo = position || (await locate(form))
        const web = form.website.trim()
        const socials = { instagram: asUrl(form.instagram), facebook: asUrl(form.facebook) }
        const hasSocials = Object.values(socials).some(Boolean)
        const body = {
          name,
          location: { street: form.street.trim(), zip: form.zip.trim(), city, state: form.state.trim(), country: form.country },
          ...(geo && { geo }),
          cuisines: form.cuisines,
          meal_types: form.meals,
          vegan: form.vegan,
          halal_certificate: form.halal,
          ...(form.price && { price_range: form.price }),
          ...(form.phone.trim() && { phone_numbers: [form.phone.trim()] }),
          ...(web && { website: /^https?:\/\//i.test(web) ? web : `https://${web}` }),
          ...(hasSocials && { social_networks: Object.fromEntries(Object.entries(socials).filter(([, v]) => v)) }),
          tags: form.tags.split(/[,#\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 15),
        }
        resto = (await api.post('/restos', body)).data.resto
        created = true
        setTarget(resto) // si l'envoi des photos échoue, on ne recrée pas le resto au nouvel essai
        if (hours && useHours) {
          try {
            await api.put(`/restos/${resto._id}/open-hours`, { timezone: hours.timezone, weekly: hours.weekly })
          } catch {
            setNote('Les horaires n’ont pas pu être enregistrés : tu pourras les ajouter plus tard.')
          }
        }
      }
      await uploadPhotos(resto)
      setPhase('done')
    } catch (err) {
      setError(created ? `Le resto est bien ajouté, mais les photos n’ont pas pu partir. ${errorMessage(err)}` : errorMessage(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setForm(EMPTY)
    setPosition(null)
    setPhotos([])
    setTarget(null)
    setDupes([])
    setDismissed(false)
    setError('')
    setPrefill(null)
    setHours(null)
    setPendingCuisines([])
    setNote('')
    setDietError(false)
    setPhase('search')
  }

  if (phase === 'done') {
    return (
      <section className="wrap fade-in done">
        <div className="soon__icon">
          <CheckCircleIcon />
        </div>
        <h1>Merci !</h1>
        <p className="auth__sub">
          <strong>{target?.name}</strong>{' '}
          {target?.verified === false && !target?.added_existing ? 'est ajouté. Il apparaîtra comme « non vérifié » jusqu’à ce qu’un admin le contrôle.' : 'a bien reçu tes photos.'}
        </p>
        {note && <p className="notice notice--soft">{note}</p>}
        <div className="prefs__actions" style={{ justifyItems: 'center' }}>
          <Link to="/" className="btn btn--primary">
            Voir le fil
          </Link>
          <button type="button" className="btn btn--link" onClick={reset}>
            Ajouter un autre resto
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="wrap addresto fade-in">
      <span className="eyebrow">Partage une adresse</span>
      <h1>Ajouter un resto</h1>

      {phase === 'search' && (
        <>
          <p className="auth__sub">Cherche le resto : on remplit l’adresse pour toi. Tu ne le trouves pas ? Remplis-le toi-même.</p>
          <PlaceSearch onPick={pick} onManual={() => setPhase('form')} />
          <PlaceCredits />
        </>
      )}

      {phase === 'photos' && target && (
        <form className="form" onSubmit={submit}>
          <p className="auth__sub">
            Ajoute tes photos de <strong>{target.name}</strong>.
          </p>
          <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="prefs__actions">
            <button className="btn btn--primary" disabled={busy || !photos.length}>
              {busy ? `Envoi…${progress != null ? ` ${progress} %` : ''}` : `Envoyer ${photos.length || ''} photo${photos.length > 1 ? 's' : ''}`}
            </button>
            <button type="button" className="btn btn--link" onClick={reset} disabled={busy}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {phase === 'form' && (
        <form className="form" onSubmit={submit}>
          {prefill && (
            <div className="notice notice--soft prefill" role="status">
              <strong>
                <MapPinIcon style={{ display: 'inline', width: 18, height: 18, verticalAlign: -3 }} /> Préremplissage{prefill.sources.length ? ` · ${prefill.sources.join(', ')}` : ''}
              </strong>
              <span>
                {prefill.filled.length ? `Trouvés : adresse, ${prefill.filled.join(', ')}.` : 'Adresse et position trouvées.'} Vérifie avant d’envoyer : ces données peuvent être anciennes.
              </span>
            </div>
          )}

          <Field label="Nom du resto">{(id) => <input id={id} value={form.name} onChange={set('name')} required maxLength={120} autoComplete="off" />}</Field>

          {dupes.length > 0 && !dismissed && !target && (
            <div className="dupes" role="status">
              <strong>Ce resto existe peut-être déjà :</strong>
              <ul>
                {dupes.map((r) => (
                  <li key={r._id}>
                    <span>
                      {r.name} <small>· {r.location.street}, {r.location.city}</small>
                    </span>
                    <button
                      type="button"
                      className="pill"
                      onClick={() => {
                        setTarget({ ...r, added_existing: true })
                        setPhotos([])
                        setPhase('photos')
                      }}
                    >
                      C’est lui : ajouter des photos
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn--link" onClick={() => setDismissed(true)}>
                Non, c’est un autre resto
              </button>
            </div>
          )}

          <fieldset className="fieldset">
            <legend>Adresse</legend>
            <Field label="Rue">{(id) => <input id={id} value={form.street} onChange={set('street')} required autoComplete="street-address" />}</Field>
            <div className="form-grid">
              <Field label="Code postal">{(id) => <input id={id} value={form.zip} onChange={set('zip')} required inputMode="numeric" autoComplete="postal-code" maxLength={12} />}</Field>
              <Field label="Ville">{(id) => <input id={id} value={form.city} onChange={set('city')} required autoComplete="address-level2" />}</Field>
            </div>
            <div className="form-grid">
              <Field label="Région">{(id) => <input id={id} value={form.state} onChange={set('state')} required autoComplete="address-level1" />}</Field>
              <Field label="Pays">
                {(id) => (
                  <select id={id} value={form.country} onChange={set('country')}>
                    {COUNTRIES.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </fieldset>

          {cuisines.length > 0 && (
            <fieldset className="fieldset">
              <legend>Type de cuisine</legend>
              <ul className="pills">
                {cuisines.map((c) => (
                  <li key={c._id}>
                    <button type="button" className="pill" aria-pressed={form.cuisines.includes(c._id)} onClick={() => setForm((f) => ({ ...f, cuisines: toggle(f.cuisines, c._id) }))}>
                      {c.cuisine_name}
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <fieldset className="fieldset">
            <legend>Budget</legend>
            <ul className="pills">
              {PRICES.map(([value, hint]) => (
                <li key={value}>
                  <button type="button" className="pill pill--budget" aria-pressed={form.price === value} onClick={() => setForm((f) => ({ ...f, price: f.price === value ? '' : value }))}>
                    <b>{value}</b> <span>{hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="fieldset">
            <legend>On y mange…</legend>
            <ul className="pills">
              {MEALS.map(([value, label]) => (
                <li key={value}>
                  <button type="button" className="pill" aria-pressed={form.meals.includes(value)} onClick={() => setForm((f) => ({ ...f, meals: toggle(f.meals, value) }))}>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="fieldset diet" id="diet" aria-describedby="diet-help">
            <legend>Halal ou option végé (obligatoire)</legend>
            <p id="diet-help" className="field__hint">
              Chaque resto est halal ou propose au moins une option végétarienne. Coche ce qui correspond.
            </p>
            <div className="manage">
              <label className="switch">
                <input type="checkbox" checked={form.halal} onChange={set('halal')} aria-invalid={dietError || undefined} />
                <span>Halal</span>
              </label>
              <label className="switch">
                <input type="checkbox" checked={form.vegan} onChange={set('vegan')} aria-invalid={dietError || undefined} />
                <span>Option végétarienne / vegan</span>
              </label>
            </div>
            {dietError && (
              <p className="alert" role="alert">
                Un resto doit être halal ou proposer une option végétarienne. Coche au moins l’une des deux cases.
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend>Pour les contacter (facultatif)</legend>
            <div className="form-grid">
              <Field label="Téléphone">{(id) => <input id={id} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={30} />}</Field>
              <Field label="Site web">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" autoComplete="url" value={form.website} onChange={set('website')} placeholder="ex. monresto.fr" maxLength={300} />}</Field>
            </div>
            <div className="form-grid">
              <Field label="Instagram">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" value={form.instagram} onChange={set('instagram')} placeholder="instagram.com/…" maxLength={300} />}</Field>
              <Field label="Facebook">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/…" maxLength={300} />}</Field>
            </div>
            <Field label="Mots-clés" hint="Séparés par des virgules : terrasse, pizza, brunch…">
              {(id) => <input id={id} value={form.tags} onChange={set('tags')} />}
            </Field>
          </fieldset>

          {hours && (
            <fieldset className="fieldset">
              <legend>Horaires trouvés</legend>
              <ul className="hours">
                {WEEK.map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <span>{showSlots(hours.weekly[key])}</span>
                  </li>
                ))}
              </ul>
              <label className="switch">
                <input type="checkbox" checked={useHours} onChange={(e) => setUseHours(e.target.checked)} />
                <span>Enregistrer ces horaires</span>
              </label>
            </fieldset>
          )}

          <fieldset className="fieldset">
            <legend>Photos (facultatif)</legend>
            <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />
          </fieldset>

          {prefill && <PlaceCredits />}
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {busy && progress != null && (
            <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="prefs__actions">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? (progress != null ? `Envoi des photos… ${progress} %` : 'Ajout en cours…') : target ? 'Réessayer d’envoyer les photos' : 'Ajouter ce resto'}
            </button>
            {target && !busy && (
              <button type="button" className="btn btn--link" onClick={() => setPhase('done')}>
                Continuer sans les photos
              </button>
            )}
            <button type="button" className="btn btn--link" onClick={reset} disabled={busy}>
              Recommencer
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
