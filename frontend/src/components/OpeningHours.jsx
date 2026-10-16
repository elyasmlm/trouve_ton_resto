const DAYS = [
  ['mon', 'Lundi'],
  ['tue', 'Mardi'],
  ['wed', 'Mercredi'],
  ['thu', 'Jeudi'],
  ['fri', 'Vendredi'],
  ['sat', 'Samedi'],
  ['sun', 'Dimanche'],
]
const KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Horaires hebdomadaires ; le jour d'aujourd'hui est en gras
export default function OpeningHours({ hours }) {
  const weekly = hours?.weekly
  if (!weekly || !DAYS.some(([k]) => weekly[k]?.length)) return null
  const today = KEYS[new Date().getDay()]
  const closure = hours.temporaryClosures
  return (
    <section className="detail__sec" aria-labelledby="horaires">
      <h2 id="horaires">Horaires</h2>
      {closure?.from && (
        <p className="alert">
          Fermeture temporaire du {closure.from} au {closure.to || '…'}
          {closure.reason ? ` : ${closure.reason}` : ''}
        </p>
      )}
      <dl className="week">
        {DAYS.map(([key, label]) => (
          <div key={key} className={key === today ? 'is-today' : ''}>
            <dt>{label}</dt>
            <dd>{weekly[key]?.length ? weekly[key].map((s) => `${s.open} – ${s.close}`).join(' · ') : 'Fermé'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
