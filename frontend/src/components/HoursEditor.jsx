import { WEEK } from '../utils/restoForm.js'

const MAX_SLOTS = 3

// Horaires de la semaine : chaque jour a zéro (fermé) à trois créneaux. `value` = { mon: [{ open, close }], ... }
export default function HoursEditor({ value, onChange }) {
  const setDay = (key, slots) => onChange({ ...value, [key]: slots })
  const setSlot = (key, i, field, text) => setDay(key, value[key].map((s, j) => (j === i ? { ...s, [field]: text } : s)))

  return (
    <div className="hedit">
      {WEEK.map(([key, label]) => {
        const slots = value[key] || []
        return (
          <div className="hedit__day" key={key}>
            <span className="hedit__label">{label}</span>
            <div className="hedit__slots">
              {slots.length === 0 && <span className="detail__muted">Fermé</span>}
              {slots.map((s, i) => (
                <div className="hedit__slot" key={i}>
                  <input type="time" aria-label={`${label}, ouverture ${i + 1}`} value={s.open} onChange={(e) => setSlot(key, i, 'open', e.target.value)} required />
                  <span aria-hidden="true">–</span>
                  <input type="time" aria-label={`${label}, fermeture ${i + 1}`} value={s.close} onChange={(e) => setSlot(key, i, 'close', e.target.value)} required />
                  <button type="button" className="hedit__x" aria-label={`Retirer ce créneau du ${label.toLowerCase()}`} onClick={() => setDay(key, slots.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
              ))}
              {slots.length < MAX_SLOTS && (
                <button type="button" className="btn btn--link hedit__add" onClick={() => setDay(key, [...slots, slots.length ? { open: '19:00', close: '22:30' } : { open: '12:00', close: '14:30' }])}>
                  + Créneau
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
